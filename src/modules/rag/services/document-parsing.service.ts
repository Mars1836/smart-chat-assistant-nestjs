import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class DocumentParsingService {
  private readonly logger = new Logger(DocumentParsingService.name);

  /**
   * Extract text from file based on mimetype
   */
  async extractText(filePath: string, mimetype: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);

      if (mimetype === 'application/pdf') {
        const data = await pdf(buffer);
        return data.text;
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        mimetype === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } else if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
      } else {
        throw new Error(`Unsupported file type: ${mimetype}`);
      }
    } catch (error) {
      this.logger.error(`Error extracting text from ${filePath}`, error);
      throw error;
    }
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
