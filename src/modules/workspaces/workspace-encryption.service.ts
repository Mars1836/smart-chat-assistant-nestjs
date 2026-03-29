import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { WorkspaceEncryptionKey } from './entities/workspace-encryption-key.entity';

/** Magic header để nhận diện file đã mã hóa */
const ENC_MAGIC = Buffer.from('ENC1', 'utf8');
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

async function vaultRequest(
  method: string,
  path: string,
  vaultAddr: string,
  vaultToken: string,
  body?: object,
): Promise<{ data?: any; errors?: string[] }> {
  const url = `${vaultAddr.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(vaultToken ? { 'X-Vault-Token': vaultToken } : {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: { data?: any; errors?: string[] };
  try {
    json = text ? (JSON.parse(text) as { data?: any; errors?: string[] }) : {};
  } catch {
    throw new Error(
      `Vault ${method} ${path}: ${res.status} response is not JSON. ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Vault ${method} ${path}: ${res.status} ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json;
}

async function ensureTransitKey(
  vaultAddr: string,
  vaultToken: string,
  kekName: string,
): Promise<void> {
  const url = `${vaultAddr.replace(/\/$/, '')}/v1/transit/keys/${kekName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(vaultToken ? { 'X-Vault-Token': vaultToken } : {}),
    },
    body: JSON.stringify({ type: 'aes256-gcm96' }),
  });
  const text = await res.text();
  let json: { errors?: string[] };
  try {
    json = text ? (JSON.parse(text) as { errors?: string[] }) : {};
  } catch {
    throw new Error(
      `Vault create key: ${res.status} response is not JSON. Body: ${text.slice(0, 200)}`,
    );
  }
  if (
    res.status === 400 &&
    json.errors?.[0]?.toLowerCase().includes('already exist')
  ) {
    return;
  }
  if (!res.ok) {
    throw new Error(`Vault create key: ${res.status} ${JSON.stringify(json)}`);
  }
}

async function generateEncryptedDek(
  vaultAddr: string,
  vaultToken: string,
  kekName: string,
): Promise<string> {
  const res = await vaultRequest(
    'POST',
    `/v1/transit/datakey/plaintext/${kekName}`,
    vaultAddr,
    vaultToken,
  );
  const ciphertext = res.data?.ciphertext;
  if (!ciphertext) {
    throw new Error('Vault datakey response missing ciphertext');
  }
  return ciphertext;
}

/**
 * Giải mã ciphertext (encrypted DEK) qua Vault Transit để lấy plaintext DEK.
 */
async function decryptCiphertext(
  vaultAddr: string,
  vaultToken: string,
  kekName: string,
  ciphertext: string,
): Promise<string> {
  const res = await vaultRequest(
    'POST',
    `/v1/transit/decrypt/${kekName}`,
    vaultAddr,
    vaultToken,
    { ciphertext },
  );
  const plaintext = res.data?.plaintext;
  if (!plaintext) {
    throw new Error('Vault decrypt response missing plaintext');
  }
  return plaintext;
}

/**
 * Service tạo DEK (Data Encryption Key) cho workspace qua Vault Transit.
 * Dùng cho Envelope Encryption: KEK trong Vault, DEK per workspace.
 */
@Injectable()
export class WorkspaceEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceEncryptionService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WorkspaceEncryptionKey)
    private readonly keyRepository: Repository<WorkspaceEncryptionKey>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.checkVaultTransitKek();
  }

  /**
   * Kiểm tra Vault Transit KEK hoạt động khi server khởi động.
   */
  async checkVaultTransitKek(): Promise<void> {
    const vaultAddr =
      this.configService.get<string>('VAULT_ADDR') ?? 'http://127.0.0.1:8200';
    const vaultToken = this.configService.get<string>('VAULT_TOKEN') ?? '';
    const kekName =
      this.configService.get<string>('VAULT_TRANSIT_KEK_NAME') ?? 'content-kek';

    if (!vaultToken) {
      this.logger.log(
        'Vault Transit: VAULT_TOKEN not set — DEK creation disabled',
      );
      return;
    }

    const wasRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (vaultAddr.startsWith('https')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    try {
      await ensureTransitKey(vaultAddr, vaultToken, kekName);
      await generateEncryptedDek(vaultAddr, vaultToken, kekName);
      this.logger.log(
        `Vault Transit KEK OK — ${kekName} at ${vaultAddr} (DEK generation works)`,
      );
    } catch (err) {
      this.logger.warn(
        `Vault Transit KEK check failed — ${kekName}: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      if (vaultAddr.startsWith('https')) {
        if (wasRejectUnauthorized !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = wasRejectUnauthorized;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }
    }
  }

  /**
   * Tạo DEK cho workspace và lưu encrypted_dek vào DB.
   * Nếu VAULT_TOKEN không có thì bỏ qua (không throw).
   */
  async createDekForWorkspace(workspaceId: string): Promise<void> {
    const vaultAddr =
      this.configService.get<string>('VAULT_ADDR') ?? 'http://127.0.0.1:8200';
    const vaultToken = this.configService.get<string>('VAULT_TOKEN') ?? '';
    const kekName =
      this.configService.get<string>('VAULT_TRANSIT_KEK_NAME') ?? 'content-kek';

    if (!vaultToken) {
      this.logger.warn(
        'VAULT_TOKEN not set; skip DEK creation for workspace ' + workspaceId,
      );
      return;
    }

    const wasRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (vaultAddr.startsWith('https')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    try {
      await ensureTransitKey(vaultAddr, vaultToken, kekName);
      const encryptedDek = await generateEncryptedDek(
        vaultAddr,
        vaultToken,
        kekName,
      );
      await this.keyRepository.save(
        this.keyRepository.create({
          workspace_id: workspaceId,
          encrypted_dek: encryptedDek,
          key_id: kekName,
        }),
      );
      this.logger.debug(`Created DEK for workspace ${workspaceId}`);
    } finally {
      if (vaultAddr.startsWith('https')) {
        if (wasRejectUnauthorized !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = wasRejectUnauthorized;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }
    }
  }

  /**
   * Lấy plaintext DEK từ workspace (giải mã encrypted_dek qua Vault).
   * Trả về null nếu workspace không có DEK hoặc Vault không cấu hình.
   */
  async getPlaintextDek(workspaceId: string): Promise<Buffer | null> {
    const vaultAddr =
      this.configService.get<string>('VAULT_ADDR') ?? 'http://127.0.0.1:8200';
    const vaultToken = this.configService.get<string>('VAULT_TOKEN') ?? '';
    const kekName =
      this.configService.get<string>('VAULT_TRANSIT_KEK_NAME') ?? 'content-kek';

    if (!vaultToken) return null;

    const keyRow = await this.keyRepository.findOne({
      where: { workspace_id: workspaceId },
    });
    if (!keyRow?.encrypted_dek) return null;

    const wasRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (vaultAddr.startsWith('https')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    try {
      const plaintextB64 = await decryptCiphertext(
        vaultAddr,
        vaultToken,
        kekName,
        keyRow.encrypted_dek,
      );
      return Buffer.from(plaintextB64, 'base64');
    } catch (err) {
      this.logger.warn(
        `getPlaintextDek failed for workspace ${workspaceId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    } finally {
      if (vaultAddr.startsWith('https')) {
        if (wasRejectUnauthorized !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = wasRejectUnauthorized;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }
    }
  }

  async hasWorkspaceDek(workspaceId: string): Promise<boolean> {
    const dek = await this.getPlaintextDek(workspaceId);
    return dek != null;
  }

  async encryptFileToPath(
    workspaceId: string,
    sourcePath: string,
    targetPath: string,
  ): Promise<boolean> {
    const dek = await this.getPlaintextDek(workspaceId);
    if (!dek) return false;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(targetPath);
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        readStream.destroy();
        cipher.destroy();
        writeStream.destroy();
        reject(error);
      };

      readStream.on('error', fail);
      cipher.on('error', fail);
      writeStream.on('error', fail);

      writeStream.write(ENC_MAGIC);
      writeStream.write(iv);

      readStream.pipe(cipher).pipe(writeStream, { end: false });

      cipher.on('end', () => {
        try {
          writeStream.end(cipher.getAuthTag());
        } catch (error) {
          fail(error);
        }
      });

      writeStream.on('finish', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
    });

    return true;
  }

  /**
   * Mã hóa nội dung bằng DEK của workspace.
   * Format: ENC1 (4 bytes) + IV (12) + ciphertext + authTag (16).
   */
  async encryptContent(
    workspaceId: string,
    plaintext: Buffer,
  ): Promise<Buffer | null> {
    const dek = await this.getPlaintextDek(workspaceId);
    if (!dek) return null;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([ENC_MAGIC, iv, encrypted, authTag]);
  }

  /**
   * Giải mã nội dung đã mã hóa.
   * Trả về null nếu không có DEK hoặc buffer không phải format ENC1.
   */
  async decryptContent(
    workspaceId: string,
    data: Buffer,
  ): Promise<Buffer | null> {
    if (data.length < ENC_MAGIC.length + IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }
    if (!data.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC)) {
      return null;
    }

    const dek = await this.getPlaintextDek(workspaceId);
    if (!dek) return null;

    const iv = data.subarray(ENC_MAGIC.length, ENC_MAGIC.length + IV_LENGTH);
    const ciphertextAndTag = data.subarray(ENC_MAGIC.length + IV_LENGTH);
    const authTag = ciphertextAndTag.subarray(-AUTH_TAG_LENGTH);
    const ciphertext = ciphertextAndTag.subarray(0, -AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /** Kiểm tra buffer có phải nội dung đã mã hóa (ENC1) không. */
  isEncrypted(data: Buffer): boolean {
    return (
      data.length >= ENC_MAGIC.length &&
      data.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC)
    );
  }

  /** Prefix cho content đã mã hóa lưu dạng string (Qdrant, DB) */
  static readonly ENCRYPTED_CONTENT_PREFIX = 'ENC1:';

  /**
   * Mã hóa chuỗi để lưu (Qdrant, DB). Trả về "ENC1:"+base64 hoặc null nếu không có DEK.
   */
  async encryptString(
    workspaceId: string,
    plaintext: string,
  ): Promise<string | null> {
    const enc = await this.encryptContent(
      workspaceId,
      Buffer.from(plaintext, 'utf-8'),
    );
    if (!enc) return null;
    return (
      WorkspaceEncryptionService.ENCRYPTED_CONTENT_PREFIX +
      enc.toString('base64')
    );
  }

  /**
   * Giải mã chuỗi đã lưu. Nếu chưa mã hóa (không có prefix ENC1:) thì trả về as-is.
   * Nếu mã hóa nhưng không giải được (Vault/DEK lỗi) thì trả về null.
   */
  async decryptString(
    workspaceId: string,
    stored: string,
  ): Promise<string | null> {
    const prefix = WorkspaceEncryptionService.ENCRYPTED_CONTENT_PREFIX;
    if (!stored.startsWith(prefix)) {
      return stored; // Chưa mã hóa → dùng nguyên bản
    }
    const base64 = stored.slice(prefix.length);
    const buf = Buffer.from(base64, 'base64');
    const dec = await this.decryptContent(workspaceId, buf);
    return dec ? dec.toString('utf-8') : null;
  }
}
