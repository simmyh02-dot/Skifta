// "Import my own template" (§6.3/§4 — same file-upload gap, same pattern as
// the bulk-invite CSV parser). The owner uploads a sample/export file from
// their accounting software (Fortnox/Visma/byrå-specific), we read just its
// header row, and the owner maps each of our known fields onto those columns.
// Pure and framework-free so header parsing can run client-side.

export type ExportField = "employee" | "periodStart" | "periodEnd" | "hours";
export const EXPORT_FIELDS: ExportField[] = [
  "employee",
  "periodStart",
  "periodEnd",
  "hours",
];

export type ColumnMapping = { header: string; field: ExportField | null }[];

function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const ch of line) {
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

/** Reads just the header row of an uploaded CSV/export sample, tolerant of a
 *  BOM and ";"/","/tab delimiters (the same Excel quirks §4 already handles). */
export function parseTemplateHeaders(text: string): string[] {
  const stripped = text.replace(/^﻿/, "");
  const firstLine = stripped.split(/\r\n|\r|\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return [];
  const delimiter = detectDelimiter(firstLine);
  return splitLine(firstLine, delimiter).filter((h) => h.length > 0);
}

/** Validates an owner-submitted column mapping: every row needs a non-blank
 *  header, an unknown/blank field stays a literal blank column (`null`), and
 *  a known field can be used at most once (mapping two columns to "hours"
 *  would silently duplicate data, so it's rejected rather than guessed). */
export function parseColumnMapping(input: unknown): ColumnMapping | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const mapping: ColumnMapping = [];
  const used = new Set<ExportField>();
  for (const c of input) {
    if (!c || typeof c !== "object") return null;
    const row = c as Record<string, unknown>;
    const header = typeof row.header === "string" ? row.header.trim() : "";
    if (!header) return null;
    const field = row.field;
    if (field !== null && (typeof field !== "string" || !EXPORT_FIELDS.includes(field as ExportField))) {
      return null;
    }
    if (field !== null) {
      if (used.has(field as ExportField)) return null;
      used.add(field as ExportField);
    }
    mapping.push({ header, field: field as ExportField | null });
  }
  return mapping;
}
