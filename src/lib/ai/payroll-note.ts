import Anthropic from "@anthropic-ai/sdk";

// AI presentation layer for the payroll draft (§8.2). The hard rule from the
// spec: the AI's job is to SUMMARISE and PRESENT — it does not compute or invent
// any number, and it never writes to the database (§8, build rule #6). The
// figures come from the deterministic engine; this only turns them into a short
// plain-language note for the owner, flagging what needs a human's eye.
//
// Model: Claude Haiku-class, as the spec specifies (§8) — the task is structured
// summarisation, not reasoning, so a heavier model would be unjustified cost.
// Degrades gracefully: with no API key (e.g. local dev) it returns a
// deterministic Swedish summary, so the whole flow runs without any AI keys.

const MODEL = "claude-haiku-4-5";

export type DraftLine = {
  name: string;
  baseHours: number;
  obHours: number;
  gross: number | null; // null = rate not set, can't compute pay
  missingRate: boolean;
  unreviewed: boolean; // has an unreviewed deviation (blocks export, §6.3)
};

export type PayrollNoteInput = {
  periodLabel: string;
  members: DraftLine[];
};

export type PayrollNote = { text: string; source: "ai" | "fallback" };

const SYSTEM = `Du är en assistent i en svensk schemaläggnings- och löneapp för små restauranger.
Du får en sammanställning av ett LÖNEUNDERLAGSUTKAST som redan är uträknat av appen.
Din enda uppgift är att SAMMANFATTA och PRESENTERA underlaget för ägaren på svenska — kortfattat, 2–3 meningar.
Hårda regler:
- Hitta ALDRIG på siffror. Använd bara de tal du får. Räkna inte om något.
- Ge inga skatte-, juridiska eller löneråd. Detta är ett underlag, inte en slutgiltig lönespec.
- Lyft fram det som behöver en människas blick: anställda utan satt timlön (kan inte beräknas) och ogranskade avvikelser (får inte exporteras tyst).
- Skriv naturligt och lugnt, inte som en lista.`;

function buildPrompt(input: PayrollNoteInput): string {
  const lines = input.members.map((m) => {
    const pay = m.missingRate ? "timlön saknas" : `brutto ${m.gross} kr`;
    const flag = m.unreviewed ? ", ogranskad avvikelse" : "";
    return `- ${m.name}: ${m.baseHours} h grund, ${m.obHours} h OB, ${pay}${flag}`;
  });
  return `Period: ${input.periodLabel}\nAnställda (${input.members.length}):\n${lines.join("\n")}`;
}

/** Deterministic Swedish summary — the no-AI fallback, and a faithful baseline
 *  that never depends on a model being reachable. */
export function fallbackNote(input: PayrollNoteInput): string {
  const missing = input.members.filter((m) => m.missingRate).map((m) => m.name);
  const unreviewed = input.members.filter((m) => m.unreviewed).map((m) => m.name);
  const totalGross = input.members.reduce((sum, m) => sum + (m.gross ?? 0), 0);
  const parts: string[] = [
    `Utkast för ${input.periodLabel}: ${input.members.length} anställda, beräknad bruttosumma ${Math.round(totalGross)} kr.`,
  ];
  if (missing.length) parts.push(`Timlön saknas för ${missing.join(", ")} — sätt den för att kunna beräkna lön.`);
  if (unreviewed.length) parts.push(`Ogranskade avvikelser för ${unreviewed.join(", ")} måste granskas före export.`);
  if (!missing.length && !unreviewed.length) parts.push("Inget kräver din åtgärd — underlaget är redo att granskas och godkännas.");
  return parts.join(" ");
}

/** Produce the owner-facing note. Uses Haiku when a key is configured, otherwise
 *  the deterministic fallback. Never throws — a model error degrades to fallback. */
export async function payrollNote(input: PayrollNoteInput): Promise<PayrollNote> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { text: fallbackNote(input), source: "fallback" };

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildPrompt(input) }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text ? { text, source: "ai" } : { text: fallbackNote(input), source: "fallback" };
  } catch {
    return { text: fallbackNote(input), source: "fallback" };
  }
}
