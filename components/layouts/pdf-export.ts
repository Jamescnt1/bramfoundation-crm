import type { LayoutDocument } from "@/components/layouts/types";
import { canvasToBlob, renderPageToCanvas } from "@/components/layouts/layout-renderer";

export async function layoutDocumentToPdf(document: LayoutDocument) {
  const pages = await Promise.all(document.pages.map(async (page) => {
    const canvas = await renderPageToCanvas(page);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  }));
  return buildJpegPdf(pages);
}

function buildJpegPdf(pages: Array<{ bytes: Uint8Array; width: number; height: number }>) {
  const objects: Uint8Array[] = [];
  const pageObjectIds: number[] = [];
  const encoder = new TextEncoder();
  const addTextObject = (value: string) => {
    objects.push(encoder.encode(value));
    return objects.length;
  };
  const addStreamObject = (dictionary: string, stream: Uint8Array) => {
    objects.push(concat(encoder.encode(`${dictionary}\nstream\n`), stream, encoder.encode("\nendstream")));
    return objects.length;
  };

  addTextObject("<< /Type /Catalog /Pages 2 0 R >>");
  addTextObject("PAGES_PLACEHOLDER");

  pages.forEach((page, index) => {
    const imageId = addStreamObject(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>`,
      page.bytes,
    );
    const content = encoder.encode(`q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im${index} Do\nQ`);
    const contentId = addStreamObject(`<< /Length ${content.length} >>`, content);
    const pageId = addTextObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  });

  objects[1] = encoder.encode(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  const header = encoder.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const chunks: Uint8Array[] = [header];
  const offsets = [0];
  let length = header.length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = concat(encoder.encode(`${index + 1} 0 obj\n`), object, encoder.encode("\nendobj\n"));
    chunks.push(chunk);
    length += chunk.length;
  });
  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(encoder.encode(xref));
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
