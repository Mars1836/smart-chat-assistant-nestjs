import 'reflect-metadata';

import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as fs from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { Document } from '../src/modules/documents/entities/document.entity';
import { Knowledge } from '../src/modules/knowledge/entities/knowledge.entity';
import { SystemRole } from '../src/modules/system-roles/entities/system-role.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Workspace } from '../src/modules/workspaces/entities/workspace.entity';
import { DocumentStorageService } from '../src/common/storage';

config();

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const deleteLocal = args.has('--delete-local');

const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'chatbot',
  entities: [Document, Knowledge, Workspace, User, SystemRole],
  synchronize: false,
};

function isGcsConfigured() {
  return (process.env.DOCUMENT_STORAGE_DRIVER || '').toLowerCase() === 'gcs';
}

function getExpectedGcsRef(workspaceId: string, fileName: string) {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is required.');
  }
  const prefix = (process.env.GCS_DOCUMENTS_PREFIX || 'documents').replace(
    /^\/+|\/+$/g,
    '',
  );
  return `gs://${bucketName}/${prefix}/${workspaceId}/${fileName}`;
}

async function main() {
  if (!isGcsConfigured()) {
    throw new Error(
      'DOCUMENT_STORAGE_DRIVER must be set to "gcs" before running migration.',
    );
  }

  const dataSource = new DataSource(dataSourceOptions);
  const storage = new DocumentStorageService(new ConfigService());

  await dataSource.initialize();
  console.log('Connected to database');
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'write'}`);
  console.log(`Delete local after upload: ${deleteLocal ? 'yes' : 'no'}`);

  try {
    const documentRepo = dataSource.getRepository(Document);
    const documents = await documentRepo.find({
      order: { uploaded_at: 'ASC' },
    });

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const document of documents) {
      if (!document.file_url || document.file_url.startsWith('gs://')) {
        skipped += 1;
        continue;
      }

      const localPath = storage.getLocalFilePath(document.file_url);
      if (!localPath) {
        skipped += 1;
        continue;
      }

      try {
        const buffer = await fs.readFile(localPath);
        const fileName = document.file_url.split('/').pop() || document.file_name;
        const nextFileUrl = isDryRun
          ? getExpectedGcsRef(document.workspace_id, fileName)
          : await storage.uploadDocument(document.workspace_id, fileName, buffer);

        console.log(
          `${isDryRun ? '[DRY RUN] ' : ''}${document.id}: ${document.file_url} -> ${nextFileUrl}`,
        );

        if (!isDryRun) {
          document.file_url = nextFileUrl;
          await documentRepo.save(document);

          if (deleteLocal) {
            await fs.unlink(localPath);
          }
        }

        migrated += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `Failed to migrate document ${document.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.log('');
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
