import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GeminiProvider } from '../../../common/providers/gemini.provider';

/** Parse CSV có cột "context" (hoặc cột đầu). Hỗ trợ field trong ngoặc kép, có thể chứa newline. */
function parseCsvContexts(content: string): string[] {
  const rows: string[][] = [];
  let i = 0;
  const len = content.length;
  const peek = () => content[i];
  const next = () => content[++i];
  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      const c = peek();
      if (c === '\r' || c === '\n') {
        next();
        if (c === '\r' && peek() === '\n') next();
        break;
      }
      if (c === '"') {
        next();
        let field = '';
        while (i < len) {
          const ch = peek();
          if (ch === '"') {
            next();
            if (peek() === '"') {
              field += '"';
              next();
            } else break;
          } else {
            field += ch;
            next();
          }
        }
        row.push(field.trim());
        if (peek() === ',') next();
      } else {
        let field = '';
        while (i < len && peek() !== ',' && peek() !== '\r' && peek() !== '\n') {
          field += peek();
          next();
        }
        row.push(field.trim());
        if (peek() === ',') next();
      }
    }
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const contextIdx = header.findIndex((h) => h === 'context');
  const colIdx = contextIdx >= 0 ? contextIdx : 0;
  return rows.slice(1).map((r) => r[colIdx] || '').filter((s) => s.trim() !== '');
}

// Supported image MIME types (full + extensions)
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

// Map file extensions to MIME types
const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

@Injectable()
export class DocumentParsingService {
  private readonly logger = new Logger(DocumentParsingService.name);

  constructor(private readonly aiStudioService: GeminiProvider) {}

  /**
   * Normalize mimetype - convert file extension to proper MIME type
   */
  private normalizeMimeType(mimetype: string): string {
    const lower = mimetype.toLowerCase();
    // If it's already a full MIME type, return as is
    if (lower.includes('/')) {
      return lower;
    }
    // Convert extension to MIME type
    return EXTENSION_TO_MIME[lower] || lower;
  }

  /**
   * Check if mimetype is an image
   */
  isImage(mimetype: string): boolean {
    const normalized = this.normalizeMimeType(mimetype);
    return IMAGE_MIME_TYPES.includes(normalized);
  }

  /**
   * Extract text from file based on mimetype
   */
  async extractText(filePath: string, mimetype: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const normalizedMime = this.normalizeMimeType(mimetype);

      this.logger.log(
        `Extracting text from ${filePath} (type: ${mimetype} → ${normalizedMime})`,
      );

      // PDF
      if (normalizedMime === 'application/pdf') {
        const data = await pdf(buffer);
        return data.text;
      }

      // Word documents
      if (
        normalizedMime ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        normalizedMime === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }

      // Plain text / Markdown
      if (
        normalizedMime === 'text/plain' ||
        normalizedMime === 'text/markdown'
      ) {
        return buffer.toString('utf-8');
      }

      // CSV: lấy cột "context" (hoặc cột đầu tiên) làm nội dung knowledge
      if (normalizedMime === 'text/csv') {
        const text = buffer.toString('utf-8');
         const contexts = parseCsvContexts(text);
        return contexts.join('\n\n---\n\n');
      }

      // Images - Use Gemini Vision for OCR/description
      if (this.isImage(normalizedMime)) {
        this.logger.log(`Processing image with Gemini Vision: ${filePath}`);
        return await this.aiStudioService.describeImage(buffer, normalizedMime);
      }

      throw new Error(`Unsupported file type: ${mimetype}`);
    } catch (error) {
      this.logger.error(`Error extracting text from ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Extract text from image using Vision AI (public method for direct use)
   */
  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    return this.aiStudioService.describeImage(imageBuffer, mimeType);
  }

  /**
   * Split text into chunks – strategy depends on file type.
   *
   * - Markdown: tách theo heading (#, ##, ...) rồi char-split trong từng section.
   * - Text/OCR: tách theo đoạn (\n\n) rồi gộp đoạn cho tới khi đủ dài.
   * - Khác: fallback dùng RecursiveCharacterTextSplitter.
   */
  async chunkText(
    text: string,
    options?: { mimeType?: string; fileName?: string },
  ): Promise<string[]> {
    const normalizedMime = options?.mimeType
      ? this.normalizeMimeType(options.mimeType)
      : '';

    // Markdown
    if (normalizedMime === 'text/markdown') {
      return this.chunkMarkdown(text);
    }

    // Plain text hoặc OCR (coi như text thường)
    if (!normalizedMime || normalizedMime === 'text/plain') {
      return this.chunkByParagraphs(text);
    }

    // Fallback cho các loại file khác (pdf/docx sau khi extract) – vẫn dùng paragraphs
    return this.chunkByParagraphs(text);
  }

  private async chunkMarkdown(text: string): Promise<string[]> {
    const lines = text.split(/\r?\n/);
    const sections: string[] = [];
    let current: string[] = [];

    const flush = () => {
      if (current.length > 0) {
        sections.push(current.join('\n').trim());
        current = [];
      }
    };

    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line)) {
        // Heading mới → đóng section cũ
        flush();
        current.push(line);
      } else {
        current.push(line);
      }
    }
    flush();

    // Với mỗi section, nếu quá dài thì tiếp tục chunk theo đoạn
    const chunks: string[] = [];
    for (const sec of sections) {
      const secChunks = await this.chunkByParagraphs(sec, 900, 150);
      chunks.push(...secChunks);
    }
    return chunks;
  }

  private async chunkByParagraphs(
    text: string,
    chunkSize = 900,
    chunkOverlap = 0, // hiện chưa dùng overlap đoạn để giữ đơn giản
  ): Promise<string[]> {
    // Tách theo đoạn: 1+ dòng trống
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) return [];

    const chunks: string[] = [];
    let current = '';

    for (const p of paragraphs) {
      // Nếu đoạn dài hơn chunkSize → cắt nhỏ bằng splitter
      if (p.length > chunkSize * 1.5) {
        if (current) {
          chunks.push(current.trim());
          current = '';
        }
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize,
          chunkOverlap,
        });
        const sub = await splitter.splitText(p);
        chunks.push(...sub.map((s) => s.trim()).filter(Boolean));
        continue;
      }

      const candidate = current ? `${current}\n\n${p}` : p;
      if (candidate.length <= chunkSize || !current) {
        current = candidate;
      } else {
        chunks.push(current.trim());
        current = p;
      }
    }

    if (current) {
      chunks.push(current.trim());
    }

    return chunks;
  }
}
