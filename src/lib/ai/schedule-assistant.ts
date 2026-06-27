import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { addDays, startOfWeek } from "../week";

// AI-assisted scheduling (§8.1). The AI's job is to turn the owner's free text
// into a STRUCTURED PROPOSAL against real schedule context (last week's
// pattern, members, tags) — it never writes to the database. The proposal is
// always shown back as an exact, editable list (date/time/name per row) and
// only persisted when the owner clicks "Godkänn" (suggest → confirm → write,
// §8, build rule #6).
//
// Model: Claude Haiku-class per the spec (§8) — structured extraction, not
// reasoning.

const MODEL = "claude-haiku-4-5";

export type ProposedShift = {
  memberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  requiredTags: string[];
  ambiguous: boolean;
  note: string;
};

export type ScheduleContext = {
  today: string;
  members: { id: string; name: string; tags: string[] }[];
  previousWeek: { memberName: string; weekday: string; startTime: string; endTime: string }[];
};

const WEEKDAY_NAMES = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

function fmtTime(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Gathers the real schedule context the AI interprets the request against:
 *  active members + their tags, and the previous week's actual shifts (so
 *  "samma som förra veckan" has something concrete to copy). */
export async function buildScheduleContext(
  restaurantId: string,
  referenceDate: Date = new Date(),
): Promise<ScheduleContext> {
  const memberships = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null },
    include: {
      user: {
        select: { id: true, displayName: true, employeeTags: { include: { tag: true } } },
      },
    },
  });
  const members = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.displayName,
    tags: m.user.employeeTags.filter((et) => et.tag.restaurantId === restaurantId).map((et) => et.tag.name),
  }));

  const thisWeekStart = startOfWeek(referenceDate);
  const prevWeekStart = addDays(thisWeekStart, -7);
  const prevWeekEnd = thisWeekStart;

  const prevShifts = await prisma.shift.findMany({
    where: { restaurantId, startsAt: { gte: prevWeekStart, lt: prevWeekEnd } },
    include: { assignedUser: { select: { displayName: true } } },
    orderBy: { startsAt: "asc" },
  });

  const previousWeek = prevShifts
    .filter((s) => s.assignedUser)
    .map((s) => {
      const startsAt = new Date(s.startsAt);
      const isoWeekday = startsAt.getUTCDay() === 0 ? 7 : startsAt.getUTCDay();
      return {
        memberName: s.assignedUser!.displayName,
        weekday: WEEKDAY_NAMES[isoWeekday - 1],
        startTime: fmtTime(startsAt),
        endTime: fmtTime(new Date(s.endsAt)),
      };
    });

  return { today: referenceDate.toISOString().slice(0, 10), members, previousWeek };
}

function buildPrompt(instruction: string, context: ScheduleContext): string {
  const memberLines = context.members
    .map((m) => `- ${m.name} (taggar: ${m.tags.length ? m.tags.join(", ") : "inga"})`)
    .join("\n");
  const prevLines = context.previousWeek.length
    ? context.previousWeek.map((s) => `- ${s.memberName}: ${s.weekday} ${s.startTime}–${s.endTime}`).join("\n")
    : "(inga pass förra veckan)";

  return `Dagens datum: ${context.today}
Anställda:
${memberLines}

Förra veckans schema:
${prevLines}

Ägarens instruktion: "${instruction}"

Föreslå pass som motsvarar instruktionen. Använd förra veckans schema som referens för "samma som förra veckan". Om en tolkning är osäker (t.ex. tiderna varierade förra veckan, eller namnet inte säkert matchar en anställd), sätt ambiguous=true och förklara kort i "note".`;
}

const TOOL: Anthropic.Tool = {
  name: "propose_shifts",
  description: "Föreslagna pass att lägga till i schemat, baserat på ägarens instruktion och schemakontexten.",
  input_schema: {
    type: "object",
    properties: {
      shifts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            memberName: { type: "string", description: "Namnet på den anställda, som angivet i kontexten." },
            date: { type: "string", description: "Datum, format YYYY-MM-DD." },
            startTime: { type: "string", description: "Starttid, format HH:MM (24h)." },
            endTime: { type: "string", description: "Sluttid, format HH:MM (24h)." },
            requiredTags: { type: "array", items: { type: "string" }, description: "Krävda kompetenstaggar, om några." },
            ambiguous: { type: "boolean", description: "True om tolkningen är osäker och ägaren bör granska extra noga." },
            note: { type: "string", description: "Kort förklaring vid osäker tolkning, annars tom sträng." },
          },
          required: ["memberName", "date", "startTime", "endTime", "requiredTags", "ambiguous", "note"],
        },
      },
    },
    required: ["shifts"],
  },
};

export class ScheduleAiUnavailableError extends Error {
  constructor() {
    super("ai_unavailable");
  }
}

/** Turns free text into a structured shift proposal. Throws
 *  ScheduleAiUnavailableError if no API key is configured — unlike §8.2's
 *  numeric draft, there is no honest deterministic fallback for "interpret
 *  this sentence", so we say so plainly instead of guessing. */
export async function proposeSchedule(
  instruction: string,
  context: ScheduleContext,
): Promise<ProposedShift[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ScheduleAiUnavailableError();

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "propose_shifts" },
    messages: [{ role: "user", content: buildPrompt(instruction, context) }],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "propose_shifts",
  );
  if (!toolUse) return [];

  const input = toolUse.input as { shifts?: unknown };
  if (!Array.isArray(input.shifts)) return [];

  return input.shifts
    .filter(
      (s): s is ProposedShift =>
        !!s &&
        typeof s === "object" &&
        typeof (s as ProposedShift).memberName === "string" &&
        typeof (s as ProposedShift).date === "string" &&
        typeof (s as ProposedShift).startTime === "string" &&
        typeof (s as ProposedShift).endTime === "string",
    )
    .map((s) => ({
      memberName: s.memberName,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      requiredTags: Array.isArray(s.requiredTags) ? s.requiredTags.filter((t) => typeof t === "string") : [],
      ambiguous: Boolean(s.ambiguous),
      note: typeof s.note === "string" ? s.note : "",
    }));
}

/** Resolves each proposed shift's member name against the real member list
 *  (case-insensitive exact match). No match → flagged ambiguous, never
 *  silently dropped or guessed (§8.1 design requirement: ambiguity must show,
 *  not hide). */
export function resolveMembers(
  shifts: ProposedShift[],
  members: { id: string; name: string }[],
): (ProposedShift & { memberId: string | null })[] {
  return shifts.map((s) => {
    const match = members.find((m) => m.name.toLowerCase() === s.memberName.trim().toLowerCase());
    return {
      ...s,
      memberId: match?.id ?? null,
      ambiguous: s.ambiguous || !match,
      note: match ? s.note : [s.note, `Hittade ingen anställd som heter "${s.memberName}".`].filter(Boolean).join(" "),
    };
  });
}
