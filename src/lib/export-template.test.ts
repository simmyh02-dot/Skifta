import { describe, expect, it } from "vitest";
import { parseColumnMapping, parseTemplateHeaders } from "./export-template";

describe("parseTemplateHeaders", () => {
  it("parses a comma-delimited header row", () => {
    expect(parseTemplateHeaders("Namn,Kod,Timmar")).toEqual(["Namn", "Kod", "Timmar"]);
  });

  it("strips a BOM and detects a semicolon delimiter (Swedish Excel)", () => {
    const text = "﻿Namn;Kod;Timmar\r\nErik;TID;40";
    expect(parseTemplateHeaders(text)).toEqual(["Namn", "Kod", "Timmar"]);
  });

  it("handles quoted headers with embedded commas", () => {
    expect(parseTemplateHeaders('"Namn, fullt";Kod')).toEqual(["Namn, fullt", "Kod"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseTemplateHeaders("")).toEqual([]);
    expect(parseTemplateHeaders("   \n  ")).toEqual([]);
  });
});

describe("parseColumnMapping", () => {
  it("accepts a valid mapping with mixed fields and blanks", () => {
    const result = parseColumnMapping([
      { header: "Namn", field: "employee" },
      { header: "Kommentar", field: null },
      { header: "Timmar", field: "hours" },
    ]);
    expect(result).toHaveLength(3);
  });

  it("rejects an empty array", () => {
    expect(parseColumnMapping([])).toBeNull();
  });

  it("rejects a blank header", () => {
    expect(parseColumnMapping([{ header: "  ", field: null }])).toBeNull();
  });

  it("rejects an unknown field name", () => {
    expect(parseColumnMapping([{ header: "X", field: "salary" }])).toBeNull();
  });

  it("rejects the same field mapped twice", () => {
    const result = parseColumnMapping([
      { header: "A", field: "hours" },
      { header: "B", field: "hours" },
    ]);
    expect(result).toBeNull();
  });

  it("rejects a non-array input", () => {
    expect(parseColumnMapping(null)).toBeNull();
    expect(parseColumnMapping("nope")).toBeNull();
  });
});
