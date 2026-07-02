import { BadRequestException } from '@nestjs/common';

export const GRADE_TYPES = Object.freeze([
  'tarea',
  'leccion',
  'examen',
  'proyecto',
  'participacion',
  'otro',
]);

export const COMPONENT_STATUSES = Object.freeze(['activo', 'inactivo']);
export const GRADE_STATUSES = Object.freeze([
  'borrador',
  'publicada',
  'anulada',
]);

const TYPE_ALIASES = Object.freeze({
  assignment: 'tarea',
  homework: 'tarea',
  lesson: 'leccion',
  exam: 'examen',
  test: 'examen',
  project: 'proyecto',
  participation: 'participacion',
});

const COMPONENT_STATUS_ALIASES = Object.freeze({
  active: 'activo',
  enabled: 'activo',
  inactive: 'inactivo',
  disabled: 'inactivo',
});

const GRADE_STATUS_ALIASES = Object.freeze({
  draft: 'borrador',
  published: 'publicada',
  publish: 'publicada',
  canceled: 'anulada',
  cancelled: 'anulada',
});

export function pickFirst(source, fields) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      return source[field];
    }
  }

  return undefined;
}

export function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

export function normalizeRequiredString(value, message) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new BadRequestException(message);
  }
  return normalized;
}

export function normalizeNumericId(value, message) {
  const normalized = normalizeRequiredString(value, message);
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(message);
  }
  return normalized;
}

export function normalizeOptionalNumericId(value, message) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalizeNumericId(normalized, message) : undefined;
}

export function normalizeLimit(value, defaultLimit = 25) {
  const parsed = parseInt(value ?? String(defaultLimit), 10);
  const normalized =
    Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
  return Math.min(Math.max(normalized, 1), 100);
}

export function normalizeOffset(value) {
  const parsed = parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  throw new BadRequestException('Valor booleano invalido');
}

export function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return normalizeBoolean(value);
}

export function normalizeNumber(value, message) {
  const normalized = normalizeRequiredString(value, message);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(message);
  }
  return parsed;
}

export function normalizeOptionalNumber(value, message) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return normalizeNumber(value, message);
}

export function normalizePercentage(value, message, options = {}) {
  const parsed = normalizeNumber(value, message);
  const min = options.min ?? 0;
  const max = options.max ?? 100;

  if (parsed < min || parsed > max) {
    throw new BadRequestException(message);
  }

  return Number(parsed.toFixed(2));
}

export function normalizeOptionalPercentage(value, message, options = {}) {
  const parsed = normalizeOptionalNumber(value, message);
  if (parsed === undefined) {
    return undefined;
  }

  const min = options.min ?? 0;
  const max = options.max ?? 100;
  if (parsed < min || parsed > max) {
    throw new BadRequestException(message);
  }

  return Number(parsed.toFixed(2));
}

export function normalizeGradeType(value, defaultType = undefined) {
  const raw = normalizeOptionalString(value);
  if (!raw) {
    return defaultType;
  }

  const normalized = raw.toLowerCase();
  const type = TYPE_ALIASES[normalized] || normalized;
  if (!GRADE_TYPES.includes(type)) {
    throw new BadRequestException('Tipo de evaluacion invalido');
  }

  return type;
}

export function normalizeComponentStatus(value, defaultStatus = undefined) {
  const raw = normalizeOptionalString(value);
  if (!raw) {
    return defaultStatus;
  }

  const normalized = raw.toLowerCase();
  const status = COMPONENT_STATUS_ALIASES[normalized] || normalized;
  if (!COMPONENT_STATUSES.includes(status)) {
    throw new BadRequestException('Estado de componente invalido');
  }

  return status;
}

export function normalizeGradeStatus(value, defaultStatus = undefined) {
  const raw = normalizeOptionalString(value);
  if (!raw) {
    return defaultStatus;
  }

  const normalized = raw.toLowerCase();
  const status = GRADE_STATUS_ALIASES[normalized] || normalized;
  if (!GRADE_STATUSES.includes(status)) {
    throw new BadRequestException('Estado de calificacion invalido');
  }

  return status;
}

export function normalizeOptionalDate(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BadRequestException('Fecha invalida, use YYYY-MM-DD');
  }

  return normalized;
}

export class CreateEvaluationComponentRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof CreateEvaluationComponentRequestDto) {
      return value;
    }

    return new CreateEvaluationComponentRequestDto({
      ofertaCursoId: normalizeOptionalNumericId(
        pickFirst(value, ['ofertaCursoId', 'oferta_curso_id']),
        'Oferta de curso invalida',
      ),
      paraleloId: normalizeOptionalString(
        pickFirst(value, ['paraleloId', 'paralelo_id']),
      ),
      nombre: normalizeRequiredString(
        pickFirst(value, ['nombre', 'name']),
        'Nombre de evaluacion requerido',
      ),
      descripcion: normalizeOptionalString(
        pickFirst(value, ['descripcion', 'description']),
      ),
      tipo: normalizeGradeType(pickFirst(value, ['tipo', 'type']), 'otro'),
      ponderacion: normalizePercentage(
        pickFirst(value, ['ponderacion', 'weight']),
        'Ponderacion invalida',
        { min: 0.01 },
      ),
      puntajeMaximo:
        normalizeOptionalPercentage(
          pickFirst(value, ['puntajeMaximo', 'puntaje_maximo', 'maxScore']),
          'Puntaje maximo invalido',
          { min: 0.01 },
        ) ?? 100,
      fechaEntrega: normalizeOptionalDate(
        pickFirst(value, ['fechaEntrega', 'fecha_entrega', 'dueDate']),
      ),
      estado: 'activo',
    });
  }
}

export class UpdateEvaluationComponentRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof UpdateEvaluationComponentRequestDto) {
      return value;
    }

    return new UpdateEvaluationComponentRequestDto({
      id: normalizeNumericId(
        pickFirst(value, ['id', 'componentId', 'component_id']),
        'Componente de evaluacion invalido',
      ),
      ofertaCursoId: normalizeOptionalNumericId(
        pickFirst(value, ['ofertaCursoId', 'oferta_curso_id']),
        'Oferta de curso invalida',
      ),
      paraleloId: normalizeOptionalString(
        pickFirst(value, ['paraleloId', 'paralelo_id']),
      ),
      nombre: normalizeOptionalString(pickFirst(value, ['nombre', 'name'])),
      descripcion: normalizeOptionalString(
        pickFirst(value, ['descripcion', 'description']),
      ),
      tipo: normalizeGradeType(pickFirst(value, ['tipo', 'type'])),
      ponderacion: normalizeOptionalPercentage(
        pickFirst(value, ['ponderacion', 'weight']),
        'Ponderacion invalida',
        { min: 0.01 },
      ),
      puntajeMaximo: normalizeOptionalPercentage(
        pickFirst(value, ['puntajeMaximo', 'puntaje_maximo', 'maxScore']),
        'Puntaje maximo invalido',
        { min: 0.01 },
      ),
      fechaEntrega: normalizeOptionalDate(
        pickFirst(value, ['fechaEntrega', 'fecha_entrega', 'dueDate']),
      ),
      estado: normalizeComponentStatus(pickFirst(value, ['estado', 'status'])),
    });
  }
}

export class ListEvaluationComponentsRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof ListEvaluationComponentsRequestDto) {
      return value;
    }

    return new ListEvaluationComponentsRequestDto({
      ofertaCursoId: normalizeOptionalNumericId(
        pickFirst(value, ['ofertaCursoId', 'oferta_curso_id']),
        'Oferta de curso invalida',
      ),
      paraleloId: normalizeOptionalString(
        pickFirst(value, ['paraleloId', 'paralelo_id']),
      ),
      estado: normalizeComponentStatus(pickFirst(value, ['estado', 'status'])),
      limit: normalizeLimit(pickFirst(value, ['limit', 'limite'])),
      offset: normalizeOffset(pickFirst(value, ['offset'])),
    });
  }
}

export class RegisterGradeRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof RegisterGradeRequestDto) {
      return value;
    }

    return new RegisterGradeRequestDto({
      matriculaId: normalizeNumericId(
        pickFirst(value, ['matriculaId', 'matricula_id']),
        'Matricula invalida',
      ),
      estudianteId: normalizeOptionalNumericId(
        pickFirst(value, ['estudianteId', 'estudiante_id']),
        'Estudiante invalido',
      ),
      componenteId: normalizeNumericId(
        pickFirst(value, ['componenteId', 'componente_id', 'componentId']),
        'Componente de evaluacion invalido',
      ),
      nota: normalizePercentage(
        pickFirst(value, ['nota', 'score']),
        'Nota invalida',
      ),
      observacion: normalizeOptionalString(
        pickFirst(value, ['observacion', 'feedback']),
      ),
      registradaPor: normalizeOptionalNumericId(
        pickFirst(value, ['registradaPor', 'registrada_por', 'teacherId']),
        'Docente invalido',
      ),
      publicar: normalizeBoolean(pickFirst(value, ['publicar', 'publish'])),
    });
  }
}

export class UpdateGradeRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof UpdateGradeRequestDto) {
      return value;
    }

    return new UpdateGradeRequestDto({
      id: normalizeNumericId(
        pickFirst(value, ['id', 'gradeId', 'grade_id']),
        'Calificacion invalida',
      ),
      componenteId: normalizeOptionalNumericId(
        pickFirst(value, ['componenteId', 'componente_id', 'componentId']),
        'Componente de evaluacion invalido',
      ),
      estudianteId: normalizeOptionalNumericId(
        pickFirst(value, ['estudianteId', 'estudiante_id']),
        'Estudiante invalido',
      ),
      nota: normalizeOptionalPercentage(
        pickFirst(value, ['nota', 'score']),
        'Nota invalida',
      ),
      observacion: normalizeOptionalString(
        pickFirst(value, ['observacion', 'feedback']),
      ),
      registradaPor: normalizeOptionalNumericId(
        pickFirst(value, ['registradaPor', 'registrada_por', 'teacherId']),
        'Docente invalido',
      ),
      estado: normalizeGradeStatus(pickFirst(value, ['estado', 'status'])),
      publicada: normalizeOptionalBoolean(
        pickFirst(value, ['publicada', 'published']),
      ),
    });
  }
}

export class ListGradesRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof ListGradesRequestDto) {
      return value;
    }

    return new ListGradesRequestDto({
      matriculaId: normalizeOptionalNumericId(
        pickFirst(value, ['matriculaId', 'matricula_id']),
        'Matricula invalida',
      ),
      estudianteId: normalizeOptionalNumericId(
        pickFirst(value, ['estudianteId', 'estudiante_id']),
        'Estudiante invalido',
      ),
      ofertaCursoId: normalizeOptionalNumericId(
        pickFirst(value, ['ofertaCursoId', 'oferta_curso_id']),
        'Oferta de curso invalida',
      ),
      estado: normalizeGradeStatus(pickFirst(value, ['estado', 'status'])),
      soloPublicadas: normalizeBoolean(
        pickFirst(value, ['soloPublicadas', 'solo_publicadas']),
      ),
      limit: normalizeLimit(pickFirst(value, ['limit', 'limite'])),
      offset: normalizeOffset(pickFirst(value, ['offset'])),
    });
  }
}

export class PublishGradesRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof PublishGradesRequestDto) {
      return value;
    }

    return new PublishGradesRequestDto({
      matriculaId: normalizeNumericId(
        pickFirst(value, ['matriculaId', 'matricula_id']),
        'Matricula invalida',
      ),
      publicadaPor: normalizeOptionalNumericId(
        pickFirst(value, ['publicadaPor', 'publicada_por']),
        'Usuario publicador invalido',
      ),
    });
  }
}

export class FinalGradeRequestDto {
  constructor(payload) {
    Object.assign(this, payload);
  }

  static from(value = {}) {
    if (value instanceof FinalGradeRequestDto) {
      return value;
    }

    return new FinalGradeRequestDto({
      matriculaId: normalizeNumericId(
        pickFirst(value, ['matriculaId', 'matricula_id']),
        'Matricula invalida',
      ),
    });
  }
}
