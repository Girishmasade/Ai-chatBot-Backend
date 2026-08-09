import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { DocumentFileType } from '@/moduels/document/document.types.js';
import { ApiError } from '@/utils/apiError.util.js';

export interface ExtractionResult {
  text: string;
  pageCount?: number;
}

type Extractor = (buffer: Buffer) => Promise<ExtractionResult>;

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const [info, textResult] = await Promise.all([
      parser.getInfo(),
      parser.getText(),
    ]);
    return { text: textResult.text, pageCount: info.total };
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

async function extractPlainText(buffer: Buffer): Promise<ExtractionResult> {
  return { text: buffer.toString('utf-8') };
}

/**
 * Markdown is extracted as plain text (not stripped of syntax) deliberately:
 * headings/lists/code fences carry semantic structure that's useful signal
 * for chunking and for the LLM at generation time. Stripping markup would
 * throw that context away for marginal cleanliness gain.
 */
const EXTRACTORS: Record<DocumentFileType, Extractor> = {
  [DocumentFileType.PDF]: extractPdf,
  [DocumentFileType.DOCX]: extractDocx,
  [DocumentFileType.TXT]: extractPlainText,
  [DocumentFileType.MARKDOWN]: extractPlainText,
};

export async function extractText(fileType: DocumentFileType, buffer: Buffer): Promise<ExtractionResult> {
  const extractor = EXTRACTORS[fileType];
  if (!extractor) {
    // Defensive — should be unreachable given upload-time validation, but a
    // silent fallback here would produce a document stuck in EXTRACTING
    // forever with no clear cause.
    throw new ApiError(500, `No extractor registered for file type: ${fileType}`);
  }

  const result = await extractor(buffer);

  if (!result.text || result.text.trim().length === 0) {
    throw new ApiError(422, 'No extractable text found in file (possibly a scanned/image-only PDF)');
  }

  return result;
}

/**
 * Cleaning pass applied uniformly after extraction, regardless of source
 * format. Kept conservative — this normalizes whitespace/control characters
 * without doing anything "smart" (like stripping numbers or stopwords) that
 * could remove information the retrieval step later needs.
 */
export function cleanText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}