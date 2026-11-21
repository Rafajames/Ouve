import { describe, expect, it } from "vitest";
import { emptyAnalysis } from "@ouve/core";
import { PDFDocument } from "pdf-lib";
import { buildReport, exportDocx, exportFileName, exportPdf, reportToLines, reportToMarkdown } from "../src/index.js";

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
