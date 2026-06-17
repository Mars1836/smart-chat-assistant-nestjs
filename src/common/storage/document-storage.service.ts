import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';

type GcsFileRef = {
  bucket: string;
  objectPath: string;
};

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private gcsClient: any | null = null;

  constructor(private readonly configService: ConfigService) {}

  async uploadDocument(
    workspaceId: string,
    fileName: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<string> {
    if (this.getDriver() === 'gcs') {
      const bucket = this.getGcsBucket();
      const objectPath = this.buildObjectPath(workspaceId, fileName);
      await bucket.file(objectPath).save(buffer, {
        resumable: false,
        contentType,
        metadata: {
          cacheControl: 'private, max-age=0, no-transform',
        },
      });
      return `gs://${this.getBucketName()}/${objectPath}`;
    }

    const targetDir = path.join(
      process.cwd(),
      'uploads',
      'documents',
      workspaceId,
    );
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, fileName), buffer);
    return `/uploads/documents/${workspaceId}/${fileName}`;
  }

  async uploadDocumentFromPath(
    workspaceId: string,
    fileName: string,
    sourcePath: string,
    contentType?: string,
  ): Promise<string> {
    if (this.getDriver() === 'gcs') {
      const bucket = this.getGcsBucket();
      const objectPath = this.buildObjectPath(workspaceId, fileName);
      const file = bucket.file(objectPath);
      const writeStream = file.createWriteStream({
        resumable: true,
        contentType,
        metadata: {
          cacheControl: 'private, max-age=0, no-transform',
        },
      });

      await pipeline(fsSync.createReadStream(sourcePath), writeStream);
      return `gs://${this.getBucketName()}/${objectPath}`;
    }

    const targetDir = path.join(
      process.cwd(),
      'uploads',
      'documents',
      workspaceId,
    );
    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, path.join(targetDir, fileName));
    return `/uploads/documents/${workspaceId}/${fileName}`;
  }
  async readDocument(fileRef: string): Promise<Buffer> {
    if (this.isGcsRef(fileRef)) {
      const { bucket, objectPath } = this.parseGcsRef(fileRef);
      const [buffer] = await this.getGcsClient()
        .bucket(bucket)
        .file(objectPath)
        .download();
      return buffer;
    }

    return fs.readFile(this.toLocalAbsolutePath(fileRef));
  }

  async deleteDocument(fileRef: string): Promise<void> {
    if (this.isGcsRef(fileRef)) {
      const { bucket, objectPath } = this.parseGcsRef(fileRef);
      try {
        await this.getGcsClient().bucket(bucket).file(objectPath).delete();
      } catch (error: any) {
        if (error?.code !== 404) {
          throw error;
        }
      }
      return;
    }

    try {
      await fs.unlink(this.toLocalAbsolutePath(fileRef));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getLocalFilePath(fileRef: string): string | null {
    if (this.isGcsRef(fileRef)) {
      return null;
    }
    return this.toLocalAbsolutePath(fileRef);
  }

  private getDriver(): 'local' | 'gcs' {
    const driver = (
      this.configService.get<string>('DOCUMENT_STORAGE_DRIVER') || 'local'
    ).toLowerCase();
    return driver === 'gcs' ? 'gcs' : 'local';
  }

  private buildObjectPath(workspaceId: string, fileName: string): string {
    const prefix = (
      this.configService.get<string>('GCS_DOCUMENTS_PREFIX') || 'documents'
    ).replace(/^\/+|\/+$/g, '');
    return `${prefix}/${workspaceId}/${fileName}`;
  }

  private toLocalAbsolutePath(fileRef: string): string {
    const normalizedRef = fileRef.startsWith('/') ? fileRef.slice(1) : fileRef;
    return path.join(process.cwd(), normalizedRef);
  }

  private isGcsRef(fileRef: string): boolean {
    return fileRef.startsWith('gs://');
  }

  private parseGcsRef(fileRef: string): GcsFileRef {
    const normalized = fileRef.replace(/^gs:\/\//, '');
    const firstSlash = normalized.indexOf('/');
    if (firstSlash === -1) {
      throw new InternalServerErrorException(
        `Invalid GCS file reference: ${fileRef}`,
      );
    }

    return {
      bucket: normalized.slice(0, firstSlash),
      objectPath: normalized.slice(firstSlash + 1),
    };
  }

  private getBucketName(): string {
    const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');
    if (!bucketName) {
      throw new InternalServerErrorException(
        'GCS_BUCKET_NAME is required when DOCUMENT_STORAGE_DRIVER=gcs',
      );
    }
    return bucketName;
  }

  private getGcsBucket(): any {
    return this.getGcsClient().bucket(this.getBucketName());
  }

  private getGcsClient(): any {
    if (this.gcsClient) {
      return this.gcsClient;
    }

    try {
      const { Storage } = require('@google-cloud/storage');
      const credentialsJson = this.configService.get<string>(
        'GCS_CREDENTIALS_JSON',
      );
      const options: Record<string, any> = {};
      const projectId = this.configService.get<string>('GCS_PROJECT_ID');
      const keyFilename = this.configService.get<string>('GCS_KEY_FILENAME');

      if (projectId) {
        options.projectId = projectId;
      }
      if (keyFilename) {
        options.keyFilename = keyFilename;
      }
      if (credentialsJson) {
        options.credentials = JSON.parse(credentialsJson);
      }

      this.gcsClient = new Storage(options);
      return this.gcsClient;
    } catch (error) {
      this.logger.error(
        'Failed to initialize Google Cloud Storage client',
        error as any,
      );
      throw new InternalServerErrorException(
        'Google Cloud Storage is not configured correctly. Install @google-cloud/storage and verify GCS credentials.',
      );
    }
  }
}
