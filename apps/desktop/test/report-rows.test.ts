import { describe, expect, it } from "vitest";
import { contextLabel, formatLength, formatWhen } from "../src/renderer/src/report-rows";

describe("biblioteca de relatórios — formatação", () => {
  it("formata duração de forma curta", () => {
    expect(formatLength(40_000)).toBe("40 s");
    expect(formatLength(12 * 60_000)).toBe("12 min");
    expect(formatLength(65 * 60_000)).toBe("1 h 05 min");
  });

  it("mostra hoje/ontem ou a data", () => {
    const now = new Date(2026, 10, 22, 15, 0).getTime();
    expect(formatWhen(new Date(2026, 10, 22, 9, 5).getTime(), now)).toMatch(/^hoje, 09:05$/);
    expect(formatWhen(new Date(2026, 10, 21, 18, 30).getTime(), now)).toMatch(/^ontem, 18:30$/);
    expect(formatWhen(new Date(2026, 10, 2, 8, 0).getTime(), now)).toMatch(/^02\/11, 08:00$/);
  });

  it("traduz o tipo de reunião", () => {
    expect(contextLabel("hearing")).toBe("Audiência");
    expect(contextLabel("general")).toBe("Geral");
  });
});
