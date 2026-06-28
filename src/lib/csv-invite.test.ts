import { describe, it, expect } from "vitest";
import { parseInviteCsv } from "./csv-invite";

describe("parseInviteCsv (§4 bulk-invite file upload)", () => {
  it("parses a simple comma file with name + contact", () => {
    const { rows, skipped } = parseInviteCsv(
      "Anna Andersson,070 123 45 67\nErik Eriksson,erik@example.com",
    );
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { name: "Anna Andersson", contact: "070 123 45 67", role: "EMPLOYEE" },
      { name: "Erik Eriksson", contact: "erik@example.com", role: "EMPLOYEE" },
    ]);
  });

  it("handles Swedish-Excel output: BOM + semicolon delimiter", () => {
    const { rows } = parseInviteCsv(
      "﻿Anna Andersson;070 123 45 67\nErik Eriksson;erik@example.com",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Anna Andersson");
    expect(rows[1].contact).toBe("erik@example.com");
  });

  it("detects and skips a header row", () => {
    const { rows } = parseInviteCsv(
      "Namn,Kontakt,Roll\nAnna,070 123 45 67,anställd\nErik,erik@example.com,medägare",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Anna");
    expect(rows[1].role).toBe("CO_OWNER");
  });

  it("does not mistake a data row for a header", () => {
    const { rows } = parseInviteCsv("Anna,070 123 45 67\nErik,erik@example.com");
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Anna");
  });

  it("maps the role column, defaulting to EMPLOYEE", () => {
    const { rows } = parseInviteCsv(
      "Anna,a@x.com,co-owner\nErik,e@x.com\nLisa,l@x.com,anställd",
    );
    expect(rows.map((r) => r.role)).toEqual(["CO_OWNER", "EMPLOYEE", "EMPLOYEE"]);
  });

  it("honours quoted fields containing the delimiter", () => {
    const { rows } = parseInviteCsv('"Andersson, Anna",070 123 45 67');
    expect(rows[0].name).toBe("Andersson, Anna");
    expect(rows[0].contact).toBe("070 123 45 67");
  });

  it("counts rows missing a name or contact as skipped, not crashing", () => {
    const { rows, skipped } = parseInviteCsv(
      "Anna,070 123 45 67\nMissingContact\n,070 000 00 00",
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it("returns nothing for empty input", () => {
    expect(parseInviteCsv("")).toEqual({ rows: [], skipped: 0 });
    expect(parseInviteCsv("\n\n  \n")).toEqual({ rows: [], skipped: 0 });
  });

  it("falls back to tab-delimited files", () => {
    const { rows } = parseInviteCsv("Anna\t070 123 45 67\nErik\terik@example.com");
    expect(rows).toHaveLength(2);
    expect(rows[0].contact).toBe("070 123 45 67");
  });
});
