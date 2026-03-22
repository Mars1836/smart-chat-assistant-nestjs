import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({
    example: 100,
    description: 'Tổng số items',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Số trang hiện tại',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Số items mỗi trang',
  })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Tổng số trang',
  })
  totalPages: number;

  @ApiProperty({
    example: true,
    description: 'Có trang tiếp theo không',
  })
  hasNextPage: boolean;

  @ApiProperty({
    example: false,
    description: 'Có trang trước đó không',
  })
  hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    isArray: true,
    description: 'Danh sách data',
  })
  data: T[];

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadata về pagination',
  })
  meta: PaginationMetaDto;
}
