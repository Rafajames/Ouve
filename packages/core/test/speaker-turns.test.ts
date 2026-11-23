import { describe, expect, it } from "vitest";
import { SpeakerMarks, matchTurns, parseSherpaTurns } from "../src/domain/speaker-turns.js";
import { TranscriptStore } from "../src/domain/transcript.js";

const SHERPA_OUT = `OfflineSpeakerDiarizationConfig(...)
Started
0.638 -- 6.848 speaker_00
7.017 -- 10.679 speaker_01
13.784 -- 16.990 speaker_02
Duration : 56.861 s`;

function storeWith(...segs: Array<[number, number, string]>): TranscriptStore {
  const store = new TranscriptStore();
  store.applyChunk({ chunkIndex: 0, offsetMs: 0, segments: segs.map(([startMs, endMs, text]) => ({ startMs, endMs, text })) });
  return store;
}

describe("separação de vozes", () => {
  it("lê a saída do sherpa-onnx (saída real da versão 1.13.8)", () => {
    expect(parseSherpaTurns(SHERPA_OUT)).toEqual([
      { startMs: 638, endMs: 6848, label: "auto:speaker_00" },
      { startMs: 7017, endMs: 10679, label: "auto:speaker_01" },
      { startMs: 13784, endMs: 16990, label: "auto:speaker_02" }
    ]);
  });

  it("atribui cada trecho ao turno com maior sobreposição", () => {
    const store = storeWith([0, 6000, "a"], [6500, 11000, "b"], [11000, 12000, "silêncio"]);
    const m = matchTurns(store.segments(), parseSherpaTurns(SHERPA_OUT));
    expect([...m.values()]).toEqual(["auto:speaker_00", "auto:speaker_01"]);
  });

  it("cria Falante 1, 2… e não desfaz a atribuição manual", () => {
    const store = storeWith([0, 6000, "a"], [7000, 10000, "b"]);
    const first = store.segments()[0]!;
    const manual = store.defineSpeaker("tecla:9", "Juiz");
    store.assignSpeaker(first.id, manual);
    expect(store.applySpeakerTurns(parseSherpaTurns(SHERPA_OUT), "auto")).toBe(1);
    const [a, b] = store.segments();
    expect(store.speakerLabel(a!.speakerId)).toBe("Juiz");
    expect(store.speakerLabel(b!.speakerId)).toBe("Falante 2");
  });

  it("teclas têm prioridade sobre a separação automática", () => {
    const store = storeWith([0, 6000, "a"]);
    store.applySpeakerTurns([{ startMs: 0, endMs: 6000, label: "tecla:2" }], "keys", { "tecla:2": "Testemunha" });
    store.applySpeakerTurns(parseSherpaTurns(SHERPA_OUT), "auto");
    expect(store.speakerLabel(store.segments()[0]!.speakerId)).toBe("Testemunha");
  });
});

describe("SpeakerMarks (teclas 1–9)", () => {
  it("gera turnos até a próxima tecla; 0 = ninguém", () => {
    const marks = new SpeakerMarks();
    marks.mark(1, 0);
    marks.mark(1, 500); // repetida: ignorada
    marks.mark(2, 10_000);
    marks.mark(0, 20_000);
    marks.mark(1, 25_000);
    expect(marks.toTurns(30_000)).toEqual([
      { startMs: 0, endMs: 10_000, label: "tecla:1" },
      { startMs: 10_000, endMs: 20_000, label: "tecla:2" },
      { startMs: 25_000, endMs: 30_000, label: "tecla:1" }
    ]);
    expect(marks.current()).toBe(1);
    expect(() => marks.mark(10, 1)).toThrow();
  });
});
