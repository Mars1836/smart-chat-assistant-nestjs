import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemRole } from './entities/system-role.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';

@Injectable()
export class SystemRolesService extends BaseService<SystemRole> {
  constructor(
    @InjectRepository(SystemRole)
    private readonly systemRoleRepository: Repository<SystemRole>,
  ) {
    super();
  }

  protected getRepository(): Repository<SystemRole> {
    return this.systemRoleRepository;
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<SystemRole>> {
    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'DESC';
    }

    return this.findAllPaginated(pagination);
  }

  findOne(id: string): Promise<SystemRole | null> {
    return this.systemRoleRepository.findOne({ where: { id } });
  }

  findByName(name: string): Promise<SystemRole | null> {
    return this.systemRoleRepository.findOne({ where: { name } });
  }
}
