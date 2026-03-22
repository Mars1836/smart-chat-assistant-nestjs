import 'reflect-metadata';

import { config } from 'dotenv';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { ConfigService } from '@nestjs/config';

config();

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function uploadBackupToGcs(filePath: string) {
  const bucketName = process.env.BACKUP_GCS_BUCKET;
  if (!bucketName) return null;

  const { Storage } = require('@google-cloud/storage');
  const configService = new ConfigService();
  const credentialsJson = configService.get<string>('GCS_CREDENTIALS_JSON');
  const projectId = configService.get<string>('GCS_PROJECT_ID');
  const keyFilename = configService.get<string>('GCS_KEY_FILENAME');
  const options: Record<string, any> = {};

  if (projectId) options.projectId = projectId;
  if (keyFilename) options.keyFilename = keyFilename;
  if (credentialsJson) options.credentials = JSON.parse(credentialsJson);

  const storage = new Storage(options);
  const prefix = (process.env.BACKUP_GCS_PREFIX || 'backups/postgres').replace(
    /^\/+|\/+$/g,
    '',
  );
  const objectName = `${prefix}/${path.basename(filePath)}`;

  await storage.bucket(bucketName).upload(filePath, {
    destination: objectName,
    metadata: {
      cacheControl: 'private, max-age=0, no-transform',
    },
  });

  return `gs://${bucketName}/${objectName}`;
}

async function main() {
  const host = required('DB_HOST');
  const port = process.env.DB_PORT || '5432';
  const username = required('DB_USERNAME');
  const password = required('DB_PASSWORD');
  const database = required('DB_NAME');
  const backupDir = path.join(process.cwd(), 'backups', 'postgres');
  const baseName = `${database}-${timestamp()}.sql`;
  const sqlPath = path.join(backupDir, baseName);
  const gzipPath = `${sqlPath}.gz`;
  const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';

  await fsp.mkdir(backupDir, { recursive: true });

  console.log(`Creating PostgreSQL backup for database "${database}"...`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      pgDump,
      ['-h', host, '-p', port, '-U', username, '-d', database, '--no-owner', '--no-privileges'],
      {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const output = fs.createWriteStream(sqlPath);
    let stderr = '';

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      output.close();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `pg_dump exited with code ${code}`));
      }
    });
  });

  await pipeline(
    fs.createReadStream(sqlPath),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    fs.createWriteStream(gzipPath),
  );

  await fsp.unlink(sqlPath);

  console.log(`Backup saved to ${gzipPath}`);

  const gcsRef = await uploadBackupToGcs(gzipPath);
  if (gcsRef) {
    console.log(`Backup uploaded to ${gcsRef}`);
  }
}

void main().catch((error) => {
  console.error('Backup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
