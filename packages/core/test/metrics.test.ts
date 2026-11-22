import { describe, expect, it } from "vitest";
import {
  LiveHintEngine,
  MarkerStore,
  StageTimer,
  computeMetrics,
  formatDuration,
  segmentForMarker,
  type TranscriptSegment
} from "../src/index.js";

const seg = (id: string, speakerId: string | undefined, startMs: number, endMs: number, text: string): TranscriptSegment =>
  speakerId ? { id, speakerId, startMs, endMs, text } : { id, startMs, endMs, text };
const speakers = [
  { id: "spk-1", label: "Juiz" },
  { id: "spk-2", label: "Testemunha" }
];

describe("computeMetrics", () => {
  const segments = [
    seg("a", "spk-1", 0, 10_000, "Qual o seu nome?"),
    seg("b", "spk-2", 11_000, 20_000, "Maria da Silva."),
    seg("c", "spk-2", 20_500, 40_000, "Moro em Boa Vista há dez anos."),
    seg("d", "spk-1", 60_000, 70_000, "Certo. Algo mais?")
  ];
  const m = computeMetrics(segments, speakers, { silenceMs: 10_000 });

  it("soma tempo de fala, participação e intervenções mesclando falas consecutivas", () => {
    const juiz = m.speakers.find((s) => s.speakerId === "spk-1")!;
    const test = m.speakers.find((s) => s.speakerId === "spk-2")!;
    expect(test.talkMs).toBe(28_500);
    expect(test.turns).toBe(1);
    expect(test.intervals).toEqual([{ startMs: 11_000, endMs: 40_000 }]);
    expect(juiz.turns).toBe(2);
    expect(juiz.questions).toBe(2);
    expect(m.questions).toBe(2);
    expect(m.speakerChanges).toBe(2);
    expect(juiz.share + test.share).toBeCloseTo(1);
    expect(m.speakers[0]!.speakerId).toBe("spk-2");
  });

  it("registra silêncios e distribui por faixas", () => {
    expect(m.silences).toEqual([{ startMs: 40_000, endMs: 60_000 }]);
    expect(m.spanMs).toBe(70_000);
    expect(m.buckets).toHaveLength(12);
  });

  it("detecta monólogos e conta trechos sem falante", () => {
    const r = computeMetrics([seg("x", "spk-1", 0, 200_000, "longa"), seg("y", undefined, 200_000, 205_000, "ruído")], speakers);
    expect(r.monologues).toEqual([{ speakerId: "spk-1", startMs: 0, endMs: 200_000 }]);
    expect(r.unattributedMs).toBe(5_000);
  });

  it("lida com transcrição vazia", () => {
    const r = computeMetrics([], speakers);
    expect(r.spanMs).toBe(0);
    expect(r.speakers).toEqual([]);
  });

  it("formata durações", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(200_000)).toBe("3 min 20 s");
    expect(formatDuration(3_900_000)).toBe("1 h 05 min");
  });
});

describe("MarkerStore", () => {
  it("ordena por tempo, edita, remove e encontra o trecho", () => {
    const store = new MarkerStore();
    const b = store.add("decision", 30_000, { note: "  aprovado  " });
    store.add("question", 5_000);
    expect(store.list().map((m) => m.atMs)).toEqual([5_000, 30_000]);
    expect(b.note).toBe("aprovado");
    store.update(b.id, { kind: "review" });
    expect(store.list()[1]!.kind).toBe("review");
    store.remove(b.id);
    expect(store.list()).toHaveLength(1);
    const segs = [seg("a", "spk-1", 0, 10_000, "x"), seg("b", "spk-2", 12_000, 20_000, "y")];
    expect(segmentForMarker(segs, 11_000)?.id).toBe("a");
    expect(segmentForMarker(segs, 15_000)?.id).toBe("b");
  });
});

describe("LiveHintEngine", () => {
  it("sugere marcador por palavra-chave e respeita o intervalo", () => {
    const engine = new LiveHintEngine({ cooldownMs: 60_000 });
    const segs = [seg("a", "spk-1", 0, 5_000, "Então fica decidido que vamos adiar.")];
    const h = engine.evaluate(segs, 6_000);
    expect(h?.suggestedMarker).toBe("decision");
    expect(engine.evaluate([...segs, seg("b", "spk-1", 6_000, 8_000, "O prazo é sexta.")], 10_000)).toBeUndefined();
    expect(engine.evaluate([...segs, seg("b", "spk-1", 6_000, 8_000, "O prazo é sexta.")], 70_000)?.text).toBe("Prazo mencionado");
  });

  it("avisa pergunta sem resposta de outro participante", () => {
    const engine = new LiveHintEngine({ cooldownMs: 0, unansweredMs: 10_000 });
    const segs = [seg("a", "spk-1", 0, 3_000, "Quem assina o termo?")];
    expect(engine.evaluate(segs, 5_000)).toBeUndefined();
    expect(engine.evaluate(segs, 20_000)?.kind).toBe("pending-question");
    expect(engine.evaluate(segs, 40_000)).toBeUndefined();
  });
});

describe("StageTimer", () => {
  it("cronometra etapas e marca falha", async () => {
    let t = 0;
    const timer = new StageTimer(() => t);
    await timer.measure("convert", async () => {
      t = 1_500;
    });
    await expect(
      timer.measure("upload", async () => {
        t = 2_000;
        throw new Error("rede");
      })
    ).rejects.toThrow("rede");
    const [convert, upload] = timer.list();
    expect(convert).toMatchObject({ stage: "convert", durationMs: 1_500, status: "done" });
    expect(upload).toMatchObject({ stage: "upload", durationMs: 500, status: "failed" });
  });
});
