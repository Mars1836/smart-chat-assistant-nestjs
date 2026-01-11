import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { CreateDocumentDto, UpdateDocumentDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService extends BaseService<Document> {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
  ) {
    super();
  }

  protected getRepository(): Repository<Document> {
    return this.documentRepo;
  }

  /**
   * Upload document
   */
  async create(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    createDto: CreateDocumentDto,
  ): Promise<Document> {
    // Kiểm tra workspace tồn tại và user có quyền
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only workspace owner can upload documents');
    }

    // Tạo thư mục uploads nếu chưa có
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents', workspaceId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Tạo unique filename
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    // Lưu file vào disk
    fs.writeFileSync(filePath, file.buffer);

    // Xác định loại file
    const fileType = createDto.type || ext.replace('.', '').toLowerCase();

    // Tạo document record
    const document = this.documentRepo.create({
      workspace_id: workspaceId,
      user_id: userId,
      file_name: createDto.file_name || file.originalname,
      file_url: `/uploads/documents/${workspaceId}/${uniqueName}`,
      type: fileType,
      size: file.size,
    });

    return await this.documentRepo.save(document);
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

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

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

    // Kiểm tra quyền truy cập
    if (document.workspace.owner_id !== userId && document.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this document');
    }

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

    // Chỉ owner workspace hoặc người upload mới được cập nhật
    if (document.workspace.owner_id !== userId && document.user_id !== userId) {
      throw new ForbiddenException('You cannot update this document');
    }

    if (updateDto.file_name) {
      document.file_name = updateDto.file_name;
    }

    return await this.documentRepo.save(document);
  }

  /**
   * Xóa document
   */
  async remove(
    workspaceId: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.findOne(workspaceId, documentId, userId);

    // Chỉ owner workspace mới được xóa
    if (document.workspace.owner_id !== userId) {
      throw new ForbiddenException('Only workspace owner can delete documents');
    }

    // Xóa file từ disk
    const filePath = path.join(process.cwd(), document.file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.documentRepo.remove(document);
  }
}
