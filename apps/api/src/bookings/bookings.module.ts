import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Arena,
  ArenaSlot,
  Booking,
  BookingLine,
  CheckIn,
  EmailLog,
  MenuItem,
  Mission,
  QueueEntry,
  User,
} from '../entities/entities';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingLine,
      ArenaSlot,
      Arena,
      User,
      MenuItem,
      EmailLog,
      QueueEntry,
      Mission,
      CheckIn,
    ]),
    AuthModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
