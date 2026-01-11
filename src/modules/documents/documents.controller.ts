import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto, DocumentResponseDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';

@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload document mới cho workspace' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File để upload (max 10MB)',
        },
        file_name: {
          type: 'string',
          description: 'Tên file tùy chỉnh (optional)',
        },
        type: {
          type: 'string',
          description: 'Loại file (optional, auto-detect)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_UPLOAD)
  async create(
    @Param('workspaceId') workspaceId: string,
    @User('sub') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.create(
      workspaceId,
      userId,
      file,
      createDocumentDto,
    );
  }

  @Get()
  @ApiExtraModels(DocumentResponseDto, PaginatedResponseDto, PaginationMetaDto)
  @ApiOperation({
    summary: 'Lấy danh sách documents của workspace (có phân trang)',
    description:
      'Trả về danh sách documents với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of documents',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(DocumentResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            workspace_id: 'workspace-uuid-here',
            user_id: 'user-uuid-here',
            file_name: 'tai-lieu.pdf',
            file_url: '/uploads/documents/workspace-id/abc123.pdf',
            type: 'pdf',
            size: 1024000,
            uploaded_at: '2024-01-01T00:00:00.000Z',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 50,
          page: 1,
          limit: 10,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_VIEW)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @User('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.documentsService.findAllByWorkspace(
      workspaceId,
      userId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết document' })
  @ApiResponse({
    status: 200,
    description: 'Document details',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_VIEW)
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
  ) {
    return this.documentsService.findOne(workspaceId, id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin document' })
  @ApiResponse({
    status: 200,
    description: 'Document updated successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_UPDATE)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(
      workspaceId,
      id,
      userId,
      updateDocumentDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_DELETE)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
  ) {
    return this.documentsService.remove(workspaceId, id, userId);
  }
}
