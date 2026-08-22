import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Arena, ArenaSlot, Booking } from '../entities/entities';
import { StatsController } from './stats.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, ArenaSlot, Arena]), AuthModule],
  controllers: [StatsController],
})
export class StatsModule {}
