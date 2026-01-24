import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GeminiProvider } from '../../../common/providers/gemini.provider';

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
   * Split text into chunks
   */
  async chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    return await splitter.splitText(text);
  }
}
