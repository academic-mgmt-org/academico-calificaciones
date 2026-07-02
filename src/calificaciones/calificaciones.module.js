import { Module } from '@nestjs/common';
import { CalificacionesService } from './calificaciones.service';

@Module({
  providers: [CalificacionesService],
  exports: [CalificacionesService],
})
export class CalificacionesModule {}
