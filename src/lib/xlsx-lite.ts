import { inflateRawSync } from "node:zlib";

export type SheetCell = {
  value: string | number | null;
  formula: boolean;
};

export type WorkbookSheets = Map<string, Map<number, Map<string, SheetCell>>>;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Read a small xlsx (store or deflate) into sheet name → row → column → cell. */
export function readXlsx(buffer: Buffer): WorkbookSheets {
  const files = readZip(buffer);
  const workbookXml = stripBom(files.get("xl/workbook.xml")?.toString("utf8") ?? "");
  const relsXml = stripBom(files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "");
  if (!workbookXml || !relsXml) throw new Error("Workbook is missing xl/workbook.xml");

  const rels = new Map<string, string>();
  for (const match of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="([^"]+)"/g)) {
    const id = match[1] || match[4];
    const target = match[2] || match[3];
    if (id && target) rels.set(id, target.replace(/^\//, ""));
  }

  const shared = parseSharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const sheets: WorkbookSheets = new Map();
  for (const match of workbookXml.matchAll(/<[^>]*sheet\b[^>]*>/g)) {
    const tag = match[0];
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    const relId = /r:id="([^"]+)"/.exec(tag)?.[1];
    if (!name || !relId) continue;
    const target = rels.get(relId);
    if (!target) throw new Error(`Workbook sheet "${decodeXml(name)}" has no file`);
    const xml = files.get(target)?.toString("utf8");
    if (!xml) throw new Error(`Workbook is missing ${target}`);
    sheets.set(decodeXml(name), parseSheet(stripBom(xml), shared));
  }
  return sheets;
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  for (const item of stripBom(xml).matchAll(/<[^>]*\bsi\b[^>]*>([\s\S]*?)<\/[^>]*si>/g)) {
    const parts = [...item[1].matchAll(/<[^>]*\bt\b[^>]*>([\s\S]*?)<\/[^>]*t>/g)].map((part) =>
      decodeXml(part[1]),
    );
    strings.push(parts.join(""));
  }
  return strings;
}

function parseSheet(xml: string, shared: string[]): Map<number, Map<string, SheetCell>> {
  const rows = new Map<number, Map<string, SheetCell>>();
  for (const rowMatch of xml.matchAll(/<[^>]*\brow\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/[^>]*row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = new Map<string, SheetCell>();
    for (const cellMatch of rowMatch[2].matchAll(
      /<[^>]*\bc\b[^>]*r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/[^>]*c>)/g,
    )) {
      const column = cellMatch[1];
      const attrs = cellMatch[2] ?? "";
      const inner = cellMatch[3] ?? "";
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const formula = /<[^>]*\bf\b[\s>]/.test(inner);
      const inline = inner.match(/<[^>]*\bt\b[^>]*>([\s\S]*?)<\/[^>]*t>/);
      const cached = inner.match(/<[^>]*\bv\b[^>]*>([\s\S]*?)<\/[^>]*v>/);
      let value: string | number | null = null;
      if (inline) value = decodeXml(inline[1]);
      else if (type === "s" && cached) value = shared[Number(cached[1])] ?? null;
      else if (cached) {
        const numeric = Number(cached[1]);
        value = Number.isFinite(numeric) ? numeric : decodeXml(cached[1]);
      }
      cells.set(column, { value, formula });
    }
    rows.set(rowNumber, cells);
  }
  return rows;
}

function readZip(buffer: Buffer): Map<string, Buffer> {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = buffer.lastIndexOf(signature);
  if (eocd < 0) throw new Error("Food cost file is not an xlsx workbook");
  const count = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff) throw new Error("ZIP64 workbooks are not supported");

  const files = new Map<string, Buffer>();
  let ptr = cdOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) throw new Error("Food cost workbook zip directory is invalid");
    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error(`Unsupported zip compression for ${name}`);
    files.set(name, data);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
