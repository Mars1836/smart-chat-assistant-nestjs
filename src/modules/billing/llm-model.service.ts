import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModel } from './entities/llm-model.entity';
import { CreateLlmModelDto } from './dto/llm-model.dto';
import { UpdateLlmModelDto } from './dto/llm-model.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface LlmModelPrices {
  inputPer1K: number;
  outputPer1K: number;
}

@Injectable()
export class LlmModelService {
  constructor(
    @InjectRepository(LlmModel)
    private readonly repo: Repository<LlmModel>,
  ) {}

  /**
   * Lấy giá per 1K input/output tokens theo provider + model.
   * Trả về { inputPer1K: 0, outputPer1K: 0 } nếu không tìm thấy.
   */
  async getPrices(provider: string, model: string): Promise<LlmModelPrices> {
    const row = await this.repo.findOne({
      where: { provider, model },
    });
    if (!row) {
      return { inputPer1K: 0, outputPer1K: 0 };
    }
    return {
      inputPer1K: Number(row.price_per_1k_input_tokens ?? 0),
      outputPer1K: Number(row.price_per_1k_output_tokens ?? 0),
    };
  }

  private readonly sortableColumns = [
    'provider',
    'model',
    'price_per_1k_input_tokens',
    'price_per_1k_output_tokens',
    'created_at',
    'updated_at',
  ] as const;

  /**
   * Danh sách toàn bộ model + giá để hiển thị bảng giá cho client (không phân trang).
   */
  async findAllForPricing(): Promise<LlmModel[]> {
    return this.repo.find({
      order: { provider: 'ASC', model: 'ASC' },
    });
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<LlmModel>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const sortBy =
      query.sortBy && this.sortableColumns.includes(query.sortBy as any)
        ? query.sortBy
        : 'created_at';
    const sortOrder = (query.sortOrder ?? 'ASC') as 'ASC' | 'DESC';

    const [data, total] = await this.repo.findAndCount({
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return createPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string): Promise<LlmModel> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('LlmModel not found');
    }
    return row;
  }

  async create(dto: CreateLlmModelDto): Promise<LlmModel> {
    const existing = await this.repo.findOne({
      where: { provider: dto.provider, model: dto.model },
    });
    if (existing) {
      throw new ConflictException(
        `Đã tồn tại bản ghi với provider="${dto.provider}" và model="${dto.model}"`,
      );
    }

    const entity = this.repo.create({
      provider: dto.provider,
      model: dto.model,
      price_per_1k_input_tokens: String(dto.price_per_1k_input_tokens),
      price_per_1k_output_tokens: String(dto.price_per_1k_output_tokens),
      display_name: dto.display_name ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateLlmModelDto): Promise<LlmModel> {
    const entity = await this.findOne(id);
    if (dto.price_per_1k_input_tokens !== undefined) {
      entity.price_per_1k_input_tokens = String(dto.price_per_1k_input_tokens);
    }
    if (dto.price_per_1k_output_tokens !== undefined) {
      entity.price_per_1k_output_tokens = String(dto.price_per_1k_output_tokens);
    }
    if (dto.display_name !== undefined) {
      entity.display_name = dto.display_name;
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
