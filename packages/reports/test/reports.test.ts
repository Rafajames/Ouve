import { describe, expect, it } from "vitest";
import { emptyAnalysis } from "@ouve/core";
import { PDFDocument } from "pdf-lib";
import {
  buildReport,
  exportDocx,
  exportFileName,
  exportPdf,
  reportToCsv,
  reportToLines,
  reportToMarkdown,
  reportToText
} from "../src/index.js";

function sample(longTranscript = false) {
  const analysis = emptyAnalysis();
  analysis.summary = "Reunião sobre remarcação da audiência. Ação: emitir certidão.";
  analysis.actionItems.push({
    id: "a1",
    title: "Enviar parecer",
    description: "Parecer técnico",
    basis: "explicit",
    assignee: "Maria",
    evidence: [{ segmentIds: ["s1"], quote: "Maria vai enviar" }]
  });
  analysis.decisions.push({ id: "d1", title: "Remarcar audiência", description: "", basis: "inferred", evidence: [] });
  const transcript = Array.from({ length: longTranscript ? 400 : 2 }, (_, i) => ({
    id: `s${i + 1}`,
    startMs: i * 5000,
    endMs: i * 5000 + 4000,
    text: `Trecho ${i + 1} com acentuação: ação, certidão, à vista — “aspas” 🙂`,
    speakerId: "spk-1"
  }));
  return buildReport({
    sessionId: "sess",
    title: "Audiência nº 12/2026",
    transcript,
    speakers: [{ id: "spk-1", label: "Falante 1" }],
    analysis,
    now: 0
  });
}

describe("relatório", () => {
  it("lista seções, marca inferências e mostra responsável/prazo", () => {
    const text = reportToLines(sample())
      .map((l) => l.text)
      .join("\n");
    expect(text).toContain("Decisões tomadas");
    expect(text).toContain("Idealizado e desenvolvido por Rafajames");
    expect(text).toContain("Remarcar audiência (inferência da IA)");
    expect(text).toContain("Responsável: Maria · Prazo: não mencionado");
    expect(text).toContain('Evidência: [00:00:00] "Maria vai enviar"');
    expect(reportToMarkdown(sample(), { includeTranscript: false })).not.toContain("## Transcrição");
  });

  it("gera nome de arquivo seguro", () => {
    expect(exportFileName("Audiência nº 12/2026", "pdf")).toBe("Audiencia-n-122026.pdf");
    expect(exportFileName("///", "docx")).toBe("relatorio.docx");
  });

  it("exporta DOCX válido (zip)", async () => {
    const bytes = await exportDocx(sample());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.byteLength).toBeGreaterThan(3000);
  });

  it("exporta PDF paginado com caracteres fora do WinAnsi substituídos", async () => {
    const bytes = await exportPdf(sample(true));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(5);
    expect(doc.getTitle()).toBe("Audiência nº 12/2026");
  });
});

describe("relatório 2.0", () => {
  it("organiza por contexto de audiência, inclui marcadores, métricas e perguntas sem resposta", () => {
    const r = sample();
    r.context = "hearing";
    r.analysis.questionsAndAnswers.push({ id: "q1", title: "Onde estava no dia?", description: "", basis: "explicit", evidence: [] });
    r.analysis.objective = "Oitiva de testemunha";
    r.markers = [{ id: "mk-1", kind: "decision", atMs: 1000, origin: "user", note: "deferido" }];
    const text = reportToLines(r)
      .map((l) => l.text)
      .join("\n");
    expect(text.indexOf("Perguntas e respostas")).toBeLessThan(text.indexOf("Tópicos discutidos"));
    expect(text).toContain("Deliberações");
    expect(text).toContain("Perguntas sem resposta identificada");
    expect(text).toContain("[00:00:01] Decisão — deferido");
    expect(text).toContain("Falas por participante (linha do tempo)");
    expect(text).toContain("Falou em: 00:00:00–00:00:09");
    expect(text).toContain("Oitiva de testemunha");
  });

  it("respeita a escolha de seções e o desligamento de horários", () => {
    const text = reportToText(sample(), {
      sections: ["decisions"],
      includeTimestamps: false,
      includeMetrics: false,
      includeTranscript: false
    });
    expect(text).toContain("DECISÕES TOMADAS");
    expect(text).not.toContain("TAREFAS");
    expect(text).not.toContain("[00:");
  });

  it("gera CSV seguro para planilhas", () => {
    const r = sample();
    r.transcript[0]!.text = "=SOMA(A1)";
    const csv = reportToCsv(r);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=SOMA(A1)"`);
    expect(exportFileName("x", "csv")).toBe("x.csv");
  });
});
