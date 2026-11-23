import type { ReportDocument } from "@ouve/core";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { OUVE_CREDIT } from "@ouve/shared";
import { reportToLines, type ExportOptions } from "./model.js";

/** Gera DOCX localmente (nenhum dado sai do dispositivo). */
export async function exportDocx(report: ReportDocument, options?: ExportOptions): Promise<Uint8Array> {
  const children = reportToLines(report, options).map((line) => {
    switch (line.kind) {
      case "h1":
        return new Paragraph({ text: line.text, heading: HeadingLevel.TITLE });
      case "h2":
        return new Paragraph({ text: line.text, heading: HeadingLevel.HEADING_1, spacing: { before: 240 } });
      case "meta":
        return new Paragraph({ children: [new TextRun({ text: line.text, italics: true, size: 18, color: "555555" })] });
      case "bullet":
        return new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line.text, bold: true })] });
      case "small":
        return new Paragraph({ bullet: { level: 1 }, children: [new TextRun({ text: line.text, size: 20 })] });
      default:
        return new Paragraph({ children: [new TextRun({ text: line.text })], spacing: { after: 120 } });
    }
  });
  const doc = new Document({
    creator: `Ouve — ${OUVE_CREDIT}`,
    title: report.title,
    description: "Relatório gerado pelo Ouve",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }]
  });
  const buffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(buffer);
}
