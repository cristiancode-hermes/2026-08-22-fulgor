import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Favorite } from '../entities/entities';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user';

class ToggleFavoriteDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  arenaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  missionId?: number;
}

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(@InjectRepository(Favorite) private readonly favs: Repository<Favorite>) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser() user: { userId: number }) {
    const items = await this.favs.find({ where: { userId: user.userId } });
    return { items };
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async toggle(@Body() dto: ToggleFavoriteDto, @CurrentUser() user: { userId: number }) {
    const where: any = { userId: user.userId };
    if (dto.arenaId) where.arenaId = dto.arenaId;
    if (dto.missionId) where.missionId = dto.missionId;
    const existing = await this.favs.findOne({ where });
    if (existing) {
      await this.favs.remove(existing);
      return { favorite: null, removed: true };
    }
    const favorite = (await this.favs.save({
      userId: user.userId,
      arenaId: dto.arenaId ?? null,
      missionId: dto.missionId ?? null,
    } as any)) as Favorite;
    return { favorite };
  }
}
