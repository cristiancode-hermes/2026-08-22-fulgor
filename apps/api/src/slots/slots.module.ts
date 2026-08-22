import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Arena, ArenaSlot, Booking } from '../entities/entities';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Arena, ArenaSlot, Booking]), AuthModule],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
