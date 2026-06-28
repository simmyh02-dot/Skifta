// CSV parsing for the §4 bulk-invite file upload. Pure and framework-free so it
// runs in the browser (the upload is parsed client-side, then the resulting rows
// go through the same validated /api/invites/bulk endpoint as the paste box) and
// is unit-testable. We deliberately handle what Swedish Excel actually emits when
// a restaurant owner does File → Save As → CSV: a BOM, semicolon delimiters
// (Excel uses the locale list separator, which is ";" in sv-SE), and quoted
// fields. True binary .xlsx parsing is out — the owner exports to CSV first.

export type ParsedInviteRow = {
  name: string;
  contact: string;
  role: "EMPLOYEE" | "CO_OWNER";
};

export type ParsedInviteCsv = {
  rows: ParsedInviteRow[];
  /** Lines that had a value but no usable name+contact pair, for honest reporting. */
  skipped: number;
};

const HEADER_WORDS = new Set([
  "namn",
  "name",
  "kontakt",
  "contact",
  "telefon",
  "phone",
  "mobil",
  "mobile",
  "nummer",
  "number",
  "epost",
  "e-post",
  "email",
  "e-mail",
  "mejl",
  "roll",
  "role",
]);

const CO_OWNER_WORDS = new Set([
  "co_owner",
  "co-owner",
  "coowner",
  "owner",
  "ägare",
  "agare",
  "medägare",
  "medagare",
  "delägare",
  "delagare",
]);

/** Pick the delimiter Excel/Sheets most likely used, by counting occurrences
 *  outside quotes in the first non-empty line. */
function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** RFC-4180-ish field splitter for a single line, honouring "" escapes. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  // A header row is one where at least one cell is a known column word and no
  // cell looks like an actual contact (digit-heavy or contains "@").
  const normalized = cells.map((c) => c.toLowerCase().replace(/\s+/g, ""));
  const hasHeaderWord = normalized.some((c) => HEADER_WORDS.has(c));
  const hasContact = cells.some((c) => c.includes("@") || /\d{4,}/.test(c));
  return hasHeaderWord && !hasContact;
}

function toRole(raw: string | undefined): "EMPLOYEE" | "CO_OWNER" {
  if (!raw) return "EMPLOYEE";
  const norm = raw.toLowerCase().replace(/\s+/g, "");
  return CO_OWNER_WORDS.has(norm) ? "CO_OWNER" : "EMPLOYEE";
}

/**
 * Parse uploaded CSV text into invite rows. Tolerant of Excel/Sheets quirks:
 * BOM, ";" or "," or tab delimiters, quoted fields, an optional header row,
 * and either two columns (name, contact) or three (name, contact, role).
 * Contact normalisation and final validation stay server-side in /api/invites/bulk.
 */
export function parseInviteCsv(text: string): ParsedInviteCsv {
  const stripped = text.replace(/^﻿/, "");
  const lines = stripped
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { rows: [], skipped: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const rows: ParsedInviteRow[] = [];
  let skipped = 0;

  lines.forEach((line, index) => {
    const cells = splitLine(line, delimiter);
    if (index === 0 && looksLikeHeader(cells)) return;

    const name = cells[0] ?? "";
    const contact = cells[1] ?? "";
    if (!name || !contact) {
      skipped++;
      return;
    }
    rows.push({ name, contact, role: toRole(cells[2]) });
  });

  return { rows, skipped };
}
