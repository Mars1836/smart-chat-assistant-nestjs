import { PartialType } from '@nestjs/swagger';
import { CreateToolDto, CreateToolActionDto } from './create-tool.dto';

export class UpdateToolDto extends PartialType(CreateToolDto) {}

export class UpdateToolActionDto extends PartialType(CreateToolActionDto) {}