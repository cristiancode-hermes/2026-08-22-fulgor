import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from '../bookings/bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, StaffGuard } from '../auth/current-user';
import { CheckInDto } from './staff.dto';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('check-in')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: { userId: number }) {
    return this.bookings.checkIn(user.userId, dto.code);
  }

  @Get('check-ins')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  list(@Query('date') date?: string) {
    return this.bookings.listCheckIns(date);
  }
}
