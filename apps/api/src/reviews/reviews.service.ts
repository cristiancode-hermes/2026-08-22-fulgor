import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arena, Booking, Review } from '../entities/entities';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Arena) private readonly arenas: Repository<Arena>,
  ) {}

  async listForArena(arenaId: number) {
    const items = await this.reviews.find({
      where: { arenaId },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
    const count = items.length;
    const avg =
      count === 0 ? 0 : Math.round((items.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10;
    return {
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: r.user ? { id: r.user.id, username: r.user.username } : null,
      })),
      avg,
      count,
    };
  }

  async create(userId: number, arenaId: number, dto: CreateReviewDto) {
    const arena = await this.arenas.findOne({ where: { id: arenaId } });
    if (!arena) throw new NotFoundException('Arena no encontrada');
    const existing = await this.reviews.findOne({ where: { userId, arenaId } });
    if (existing) throw new ConflictException('Ya has reseñado esta arena');
    const userBookings = await this.bookings.find({
      where: { userId, status: 'completed' },
      relations: { slot: true },
    });
    const ok = userBookings.some((b) => b.slot?.arenaId === arenaId);
    if (!ok) throw new ForbiddenException('Solo puedes reseñar arenas con partida completed');
    const review = (await this.reviews.save({
      userId,
      arenaId,
      rating: dto.rating,
      comment: dto.comment || '',
    } as any)) as Review;
    return { review };
  }
}
