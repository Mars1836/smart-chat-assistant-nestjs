import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Workspace } from './workspace.entity';

/**
 * Lưu encrypted DEK (Data Encryption Key) per workspace cho Envelope Encryption.
 * DEK được wrap bởi KEK trong Vault Transit; chỉ lưu ciphertext (encrypted_dek).
 */
@Entity({ name: 'workspace_encryption_keys' })
export class WorkspaceEncryptionKey extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  workspace_id: string;

  /** Ciphertext DEK từ Vault (format vault:v1:...) */
  @Column({ type: 'text' })
  encrypted_dek: string;

  /** Tên key trong Vault Transit (KEK name), ví dụ content-kek */
  @Column({ type: 'varchar', length: 100 })
  key_id: string;

  @OneToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;
}
