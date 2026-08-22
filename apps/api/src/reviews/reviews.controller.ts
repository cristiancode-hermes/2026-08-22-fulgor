import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateReviewDto, ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('arenas/:id/reviews')
  list(@Param('id', ParseIntPipe) id: number) {
    return this.reviews.listForArena(id);
  }

  @Post('arenas/:id/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.reviews.create(user.userId, id, dto);
  }
}
