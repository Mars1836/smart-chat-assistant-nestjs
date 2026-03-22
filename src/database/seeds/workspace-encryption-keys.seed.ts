import { DataSource } from 'typeorm';
import { Workspace } from '../../modules/workspaces/entities/workspace.entity';
import { WorkspaceEncryptionKey } from '../../modules/workspaces/entities/workspace-encryption-key.entity';

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

/**
 * Đảm bảo KEK tồn tại trong Vault Transit (tạo nếu chưa có).
 */
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
      `Vault create key: ${res.status} response is not JSON. Check VAULT_ADDR (http vs https). Body: ${text.slice(0, 200)}`,
    );
  }
  if (res.status === 400 && json.errors?.[0]?.toLowerCase().includes('already exist')) {
    console.log(`  ↻ Transit key already exists: ${kekName}`);
    return;
  }
  if (!res.ok) {
    throw new Error(`Vault create key: ${res.status} ${JSON.stringify(json)}`);
  }
  console.log(`  + Created Transit key: ${kekName}`);
}

/**
 * Generate DEK từ Vault; trả về ciphertext (encrypted DEK) để lưu DB.
 */
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
 * Seed: KEK trong Vault Transit (tạo nếu chưa có), sinh DEK (encrypted) cho từng workspace cũ,
 * lưu encrypted_dek vào bảng workspace_encryption_keys.
 *
 * Yêu cầu:
 * - Vault chạy, Transit engine đã enable: vault secrets enable transit
 * - VAULT_ADDR (mặc định http://127.0.0.1:8200), VAULT_TOKEN có quyền transit.
 *
 * Idempotent: workspace đã có bản ghi encryption key sẽ bỏ qua.
 */
export async function seedWorkspaceEncryptionKeys(
  dataSource: DataSource,
): Promise<void> {
  // Đọc env tại runtime (sau khi dotenv đã load trong seed.ts)
  const vaultAddr = process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200';
  const vaultToken = process.env.VAULT_TOKEN ?? '';
  const kekName = process.env.VAULT_TRANSIT_KEK_NAME ?? 'content-kek';

  if (!vaultToken) {
    console.warn('  ⚠ VAULT_TOKEN not set; skip workspace encryption keys seed.');
    return;
  }

  // Vault HTTPS với self-signed cert (local): tạm tắt TLS verify cho seed
  const wasRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (vaultAddr.startsWith('https')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  try {
    await ensureTransitKey(vaultAddr, vaultToken, kekName);

    const workspaceRepo = dataSource.getRepository(Workspace);
    const keyRepo = dataSource.getRepository(WorkspaceEncryptionKey);

    const workspaces = await workspaceRepo.find({ select: ['id'] });
    if (workspaces.length === 0) {
      console.log('  ↻ No workspaces to seed encryption keys');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const ws of workspaces) {
      const existing = await keyRepo.findOne({ where: { workspace_id: ws.id } });
      if (existing) {
        skipped++;
        continue;
      }

      const encryptedDek = await generateEncryptedDek(vaultAddr, vaultToken, kekName);
      await keyRepo.save(
        keyRepo.create({
          workspace_id: ws.id,
          encrypted_dek: encryptedDek,
          key_id: kekName,
        }),
      );
      created++;
    }

    console.log(
      `  + Workspace encryption keys: ${created} created, ${skipped} already existed`,
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
