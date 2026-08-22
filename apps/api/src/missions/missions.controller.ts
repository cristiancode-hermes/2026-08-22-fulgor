import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Mission } from '../entities/entities';

@ApiTags('missions')
@Controller('missions')
export class MissionsController {
  constructor(@InjectRepository(Mission) private readonly missions: Repository<Mission>) {}

  @Get()
  async list(@Query('q') q?: string, @Query('mode') mode?: string) {
    const qb = this.missions.createQueryBuilder('m').where('m.active = :a', { a: true });
    if (q) qb.andWhere('(m.name LIKE :q OR m.description LIKE :q)', { q: `%${q}%` });
    if (mode) qb.andWhere('m.mode = :mode', { mode });
    qb.orderBy('m.name', 'ASC');
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const mission = await this.missions.findOne({ where: { id } });
    if (!mission) throw new NotFoundException('Misión no encontrada');
    return { mission };
  }
}
