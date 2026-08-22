import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Arena,
  ArenaSlot,
  Booking,
  BookingLine,
  CheckIn,
  EmailLog,
  Favorite,
  MenuItem,
  Mission,
  QueueEntry,
  Review,
  User,
} from '../entities/entities';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Arena,
      ArenaSlot,
      Booking,
      BookingLine,
      MenuItem,
      Mission,
      QueueEntry,
      Review,
      EmailLog,
      Favorite,
      CheckIn,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
