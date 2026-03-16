import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Document } from './entities/document.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Knowledge } from '../knowledge/entities/knowledge.entity';
import { CreateDocumentDto, UpdateDocumentDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import * as path from 'path';
import { DocumentStorageService } from '../../common/storage';
import { RagService } from '../rag/rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkspaceEncryptionService } from '../workspaces/workspace-encryption.service';

@Injectable()
export class DocumentsService extends BaseService<Document> {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(Knowledge)
    private readonly knowledgeRepo: Repository<Knowledge>,
    private readonly ragService: RagService,
    private readonly knowledgeService: KnowledgeService,
    private readonly jwtService: JwtService,
    private readonly workspaceEncryptionService: WorkspaceEncryptionService,
    private readonly documentStorageService: DocumentStorageService,
  ) {
    super();
  }

  protected getRepository(): Repository<Document> {
    return this.documentRepo;
  }

  /**
   * Upload document to a knowledge base
   */
  async create(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    createDto: CreateDocumentDto,
  ): Promise<Document> {
    // Verify workspace exists
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Verify knowledge base exists and belongs to workspace
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id: createDto.knowledge_id, workspace_id: workspaceId },
    });
    if (!knowledge) {
      throw new NotFoundException('Knowledge base not found in this workspace');
    }

    // Permission check handled by PermissionsGuard

    // Create unique filename
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

    // Mã hóa nội dung nếu workspace có DEK (bỏ qua nếu Vault/DEK lỗi)
    let contentToWrite: Buffer = file.buffer;
    try {
      const encrypted = await this.workspaceEncryptionService.encryptContent(
        workspaceId,
        file.buffer,
      );
      if (encrypted) {
        contentToWrite = encrypted;
      }
    } catch {
      // Vault/DEK lỗi: upload plaintext, không fail
    }

    const fileRef = await this.documentStorageService.uploadDocument(
      workspaceId,
      uniqueName,
      contentToWrite,
      file.mimetype,
    );

    // Determine file type
    const fileType = createDto.type || ext.replace('.', '').toLowerCase();

    // Create document record
    const document = this.documentRepo.create({
      workspace_id: workspaceId,
      knowledge_id: createDto.knowledge_id,
      user_id: userId,
      file_name: createDto.file_name || file.originalname,
      file_url: fileRef,
      type: fileType,
      size: file.size,
      status: 'pending',
    });

    const savedDoc = await this.documentRepo.save(document);

    // Update knowledge stats
    await this.knowledgeService.updateStats(createDto.knowledge_id);

    // Trigger RAG Indexing (Async)
    await this.ragService.indexDocument(
      savedDoc.id,
      fileType,
      userId,
    );

    return savedDoc;
  }

  /**
   * Lấy danh sách documents của workspace (có phân trang)
   */
  async findAllByWorkspace(
    workspaceId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Document>> {
    // Kiểm tra workspace và quyền truy cập
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Permission check handled by PermissionsGuard

    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'uploaded_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { workspace_id: workspaceId },
      relations: ['user'],
    });
  }

  /**
   * Lấy thông tin chi tiết document
   */
  async findOne(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, workspace_id: workspaceId },
      relations: ['user', 'workspace'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Permission check handled by PermissionsGuard

    return document;
  }

  /**
   * Cập nhật document
   */
  async update(
    workspaceId: string,
    documentId: string,
    userId: string,
    updateDto: UpdateDocumentDto,
  ): Promise<Document> {
    const document = await this.findOne(workspaceId, documentId, userId);

    // Permission check handled by PermissionsGuard

    if (updateDto.file_name) {
      document.file_name = updateDto.file_name;
    }

    return await this.documentRepo.save(document);
  }

  /**
   * Delete document
   */
  async remove(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.findOne(workspaceId, documentId, userId);
    const knowledgeId = document.knowledge_id;

    // Permission check handled by PermissionsGuard

    await this.documentStorageService.deleteDocument(document.file_url);

    // Delete vectors from PostgreSQL and Qdrant
    await this.ragService.deleteDocumentVectors(documentId);

    await this.documentRepo.remove(document);

    // Update knowledge stats
    if (knowledgeId) {
      await this.knowledgeService.updateStats(knowledgeId);
    }
  }

  /**
   * Get documents by knowledge base
   */
  async findByKnowledge(
    workspaceId: string,
    knowledgeId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Document>> {
    // Verify knowledge belongs to workspace
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id: knowledgeId, workspace_id: workspaceId },
    });
    if (!knowledge) {
      throw new NotFoundException('Knowledge base not found');
    }

    if (!pagination.sortBy) {
      pagination.sortBy = 'uploaded_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { knowledge_id: knowledgeId },
      relations: ['user'],
    });
  }

  /**
   * Generate short-lived access token for viewing document
   */

  async generateAccessToken(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<string> {
    const document = await this.findOne(workspaceId, documentId, userId);
    
    // Check permission handled by findOne (and controller guard)

    const payload = {
      sub: userId,
      workspaceId,
      documentId,
      type: 'document_access',
    };

    return this.jwtService.sign(payload, { expiresIn: '5m' }); // Token valid for 5 minutes
  }

  /**
   * Get physical file path for document (dùng khi file không mã hóa)
   */
  async getFilePath(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<{ path: string; mimetype: string; filename: string }> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, workspace_id: workspaceId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const absolutePath = this.documentStorageService.getLocalFilePath(
      document.file_url,
    );
    if (!absolutePath) {
      throw new NotFoundException(
        'Physical path is not available when document storage is cloud-based',
      );
    }

    return {
      path: absolutePath,
      mimetype: this.getMimeType(document.type),
      filename: document.file_name,
    };
  }

  /**
   * Lấy nội dung file (đã giải mã nếu cần) để phục vụ view/download.
   */
  async getFileContent(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, workspace_id: workspaceId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    let buffer: Buffer;
    try {
      buffer = await this.documentStorageService.readDocument(document.file_url);
    } catch {
      throw new NotFoundException('File not found on server');
    }

    // Giải mã nếu file đã mã hóa (ENC1); bỏ qua nếu chưa mã hóa
    if (this.workspaceEncryptionService.isEncrypted(buffer)) {
      try {
        const decrypted = await this.workspaceEncryptionService.decryptContent(
          workspaceId,
          buffer,
        );
        if (decrypted) {
          buffer = Buffer.from(decrypted);
        }
        // decrypt null = DEK/Vault lỗi → không thể trả nội dung
        else {
          throw new NotFoundException(
            'File is encrypted but decryption failed (Vault/DEK unavailable)',
          );
        }
      } catch (e) {
        if (e instanceof NotFoundException) throw e;
        throw new NotFoundException(
          'File is encrypted but decryption failed: ' +
            (e instanceof Error ? e.message : String(e)),
        );
      }
    }

    return {
      buffer,
      mimetype: this.getMimeType(document.type),
      filename: document.file_name,
    };
  }

  private getMimeType(type: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    return map[type.toLowerCase()] || 'application/octet-stream';
  }
}
