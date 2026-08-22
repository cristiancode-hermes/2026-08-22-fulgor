import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Arena, ArenaSlot, Booking, Review } from '../entities/entities';
import { ArenasService } from './arenas.service';
import { ArenasController } from './arenas.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Arena, ArenaSlot, Booking, Review]), AuthModule],
  controllers: [ArenasController],
  providers: [ArenasService],
  exports: [ArenasService],
})
export class ArenasModule {}
