import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArenasService } from './arenas.service';
import { CreateArenaDto, UpdateArenaDto } from './arenas.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/current-user';

@ApiTags('arenas')
@Controller('arenas')
export class ArenasController {
  constructor(private readonly arenas: ArenasService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('q') q?: string,
    @Query('date') date?: string,
  ) {
    return this.arenas.findAll({ type, q, date });
  }

  @Get('featured')
  featured(@Query('date') date?: string) {
    return this.arenas.featured(date);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.arenas.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  create(@Body() dto: CreateArenaDto) {
    return this.arenas.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArenaDto) {
    return this.arenas.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.arenas.softDelete(id);
  }
}
