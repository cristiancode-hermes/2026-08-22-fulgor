import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BookingsModule, AuthModule],
  controllers: [StaffController],
})
export class StaffModule {}
