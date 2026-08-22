import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import {
  ConfirmBookingDto,
  HoldBookingDto,
  PatchBookingDto,
  QueueReorderDto,
  QueueReplaceDto,
} from './bookings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, StaffGuard } from '../auth/current-user';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings/hold')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  hold(@Body() dto: HoldBookingDto, @CurrentUser() user: { userId: number }) {
    return this.bookings.hold(user.userId, dto);
  }

  @Patch('bookings/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchBookingDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.patchHold(user.userId, id, dto);
  }

  @Post('bookings/:id/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: ConfirmBookingDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.confirm(user.userId, id);
  }

  @Get('emails')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  emails(@CurrentUser() user: { userId: number }) {
    return this.bookings.listEmails(user.userId);
  }

  @Get('bookings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: { userId: number }, @Query('status') status?: string) {
    return this.bookings.listMine(user.userId, { status });
  }

  @Get('bookings/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  detail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number; role: string },
  ) {
    return this.bookings.detail(user.userId, id, user.role);
  }

  @Post('bookings/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number }) {
    return this.bookings.cancel(user.userId, id);
  }

  @Post('bookings/:id/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StaffGuard)
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number }) {
    return this.bookings.complete(user.userId, id);
  }

  @Put('bookings/:id/queue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setQueue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QueueReplaceDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.setQueue(user.userId, id, dto.missionIds || []);
  }

  @Patch('bookings/:id/queue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QueueReorderDto,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.reorderQueue(user.userId, id, dto.orderedEntryIds || []);
  }

  @Post('bookings/:id/queue/:entryId/advance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  advance(
    @Param('id', ParseIntPipe) id: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.advanceQueue(user.userId, id, entryId);
  }

  @Delete('bookings/:id/queue/:entryId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeQueue(
    @Param('id', ParseIntPipe) id: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @CurrentUser() user: { userId: number },
  ) {
    return this.bookings.removeQueueEntry(user.userId, id, entryId);
  }
}
