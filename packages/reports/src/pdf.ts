import type { ReportDocument } from "@ouve/core";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { OUVE_CREDIT } from "@ouve/shared";
import { reportToLines, type ReportLine } from "./model.js";

const PAGE = { width: 595.28, height: 841.89, margin: 56 };

const STYLE: Record<
  ReportLine["kind"],
  { size: number; bold?: boolean; italic?: boolean; indent: number; gapBefore: number; color: number }
> = {
  h1: { size: 20, bold: true, indent: 0, gapBefore: 0, color: 0.07 },
  h2: { size: 14, bold: true, indent: 0, gapBefore: 14, color: 0.1 },
  meta: { size: 9, italic: true, indent: 0, gapBefore: 2, color: 0.4 },
  p: { size: 11, indent: 0, gapBefore: 4, color: 0.1 },
  bullet: { size: 11, bold: true, indent: 12, gapBefore: 6, color: 0.1 },
  small: { size: 9.5, indent: 26, gapBefore: 2, color: 0.3 }
};

/** Substitui caracteres fora da codificação WinAnsi das fontes padrão (acentos pt-BR são suportados). */
export function toWinAnsiSafe(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text.replace(/\t/g, "  ").replace(/[\r\n]+/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // Palavra maior que a linha: quebra por caracteres.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** Gera PDF localmente com paginação e quebra de linhas. */
export async function exportPdf(report: ReportDocument, options?: { includeTranscript?: boolean }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(report.title);
  pdf.setCreator(`Ouve — ${OUVE_CREDIT}`);
  pdf.setProducer("Ouve");
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique)
  };
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const width = PAGE.width - PAGE.margin * 2;

  for (const line of reportToLines(report, options)) {
    const style = STYLE[line.kind];
    const font = style.bold ? fonts.bold : style.italic ? fonts.italic : fonts.regular;
    const prefix = line.kind === "bullet" ? "• " : "";
    const rows = wrap(prefix + toWinAnsiSafe(line.text, font), font, style.size, width - style.indent);
    const lineHeight = style.size * 1.35;
    y -= style.gapBefore;
    if (line.kind === "h2" && y - lineHeight * 3 < PAGE.margin) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
    for (const row of rows) {
      if (y - lineHeight < PAGE.margin) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - PAGE.margin;
      }
      y -= lineHeight;
      page.drawText(row, { x: PAGE.margin + style.indent, y, size: style.size, font, color: rgb(style.color, style.color, style.color) });
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Ouve · ${OUVE_CREDIT} · página ${i + 1} de ${pages.length}`, {
      x: PAGE.margin,
      y: 28,
      size: 8,
      font: fonts.regular,
      color: rgb(0.5, 0.5, 0.5)
    });
  });
  return pdf.save();
}
