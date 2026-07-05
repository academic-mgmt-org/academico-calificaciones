const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CycleFinalSummaryRequestDto,
  CreateEvaluationComponentRequestDto,
  CreateMatriculaAsignaturaRequestDto,
  FinalGradeRequestDto,
  ListEvaluationComponentsRequestDto,
  ListGradesRequestDto,
  ListMatriculaAsignaturasRequestDto,
  PublishGradesRequestDto,
  RegisterGradeRequestDto,
  UpdateEvaluationComponentRequestDto,
  UpdateGradeRequestDto,
  normalizeBoolean,
  normalizeComponentStatus,
  normalizeGradeStatus,
  normalizeGradeType,
  normalizeLimit,
  normalizeOffset,
  normalizeSubjectEnrollmentStatus,
} = require('../dist/src/calificaciones/dto/calificaciones.dto.js');

test('registra notas en escala de 0 a 10', () => {
  const request = RegisterGradeRequestDto.from({
    matricula_asignatura_codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    componente_id: '1',
    nota: 10,
  });

  assert.equal(
    request.matriculaAsignaturaCodigo,
    'MAT-001:2026A:SW-101:A:DOC-1',
  );
  assert.equal(request.nota, 10);
  assert.throws(
    () =>
      RegisterGradeRequestDto.from({
        matricula_asignatura_codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
        componente_id: '1',
        nota: 10.01,
      }),
    /Nota invalida/,
  );
});

test('actualiza notas solo dentro de la escala de 0 a 10', () => {
  assert.equal(UpdateGradeRequestDto.from({ id: '1', nota: 0 }).nota, 0);
  assert.equal(UpdateGradeRequestDto.from({ id: '1', nota: 9.2 }).nota, 9.2);
  assert.throws(
    () => UpdateGradeRequestDto.from({ id: '1', nota: 100 }),
    /Nota invalida/,
  );
});

test('usa puntaje maximo 10 por defecto en componentes de evaluacion', () => {
  const request = CreateEvaluationComponentRequestDto.from({
    nombre: 'Examen parcial',
    tipo: 'examen',
    ponderacion: 40,
  });

  assert.equal(request.puntajeMaximo, 10);
  assert.throws(
    () =>
      CreateEvaluationComponentRequestDto.from({
        nombre: 'Examen parcial',
        tipo: 'examen',
        ponderacion: 40,
        puntaje_maximo: 100,
      }),
    /Puntaje maximo invalido/,
  );
});

test('normaliza actualizaciones y listados de componentes de evaluacion', () => {
  const update = UpdateEvaluationComponentRequestDto.from({
    component_id: '12',
    oferta_curso_id: '45',
    paralelo_id: 'A',
    name: 'Proyecto final',
    description: 'Entrega integradora',
    type: 'project',
    weight: '35.456',
    maxScore: '9.75',
    dueDate: '2026-08-31',
    status: 'disabled',
  });

  assert.deepEqual({ ...update }, {
    id: '12',
    ofertaCursoId: '45',
    paraleloId: 'A',
    nombre: 'Proyecto final',
    descripcion: 'Entrega integradora',
    tipo: 'proyecto',
    ponderacion: 35.46,
    puntajeMaximo: 9.75,
    fechaEntrega: '2026-08-31',
    estado: 'inactivo',
  });
  assert.equal(UpdateEvaluationComponentRequestDto.from(update), update);

  const list = ListEvaluationComponentsRequestDto.from({
    ofertaCursoId: '45',
    paraleloId: 'A',
    estado: 'active',
    limite: '250',
    offset: '5',
  });

  assert.deepEqual({ ...list }, {
    ofertaCursoId: '45',
    paraleloId: 'A',
    estado: 'activo',
    limit: 100,
    offset: 5,
  });
  assert.equal(ListEvaluationComponentsRequestDto.from(list), list);
});

test('normaliza matriculas-asignatura para crear y listar', () => {
  const create = CreateMatriculaAsignaturaRequestDto.from({
    matricula_asignatura_codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matricula_codigo: 'MAT-001',
    estudiante_id: '101',
    estudiante_cedula: '0102030405',
    oferta_curso_id: '202',
    ciclo_acad_codigo: '2026A',
    materia_codigo: 'SW-101',
    paralelo_codigo: 'A',
    docente_cedula: 'DOC-1',
    nivel_codigo: 'N1',
    depen_codigo: 'DEP',
    status: 'approved',
  });

  assert.deepEqual({ ...create }, {
    codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    estudianteId: '101',
    estudianteCedula: '0102030405',
    ofertaCursoId: '202',
    cicloAcadCodigo: '2026A',
    materiaCodigo: 'SW-101',
    paraleloCodigo: 'A',
    docenteCedula: 'DOC-1',
    nivelCodigo: 'N1',
    depenCodigo: 'DEP',
    estado: 'aprobado',
  });
  assert.equal(CreateMatriculaAsignaturaRequestDto.from(create), create);

  const list = ListMatriculaAsignaturasRequestDto.from({
    codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    estudianteId: '101',
    estudianteCedula: '0102030405',
    ofertaCursoId: '202',
    cicloAcadCodigo: '2026A',
    materiaCodigo: 'SW-101',
    paraleloCodigo: 'A',
    docenteCedula: 'DOC-1',
    estado: 'failed',
    limit: '10',
    offset: '2',
  });

  assert.deepEqual({ ...list }, {
    codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    estudianteId: '101',
    estudianteCedula: '0102030405',
    ofertaCursoId: '202',
    cicloAcadCodigo: '2026A',
    materiaCodigo: 'SW-101',
    paraleloCodigo: 'A',
    docenteCedula: 'DOC-1',
    estado: 'reprobado',
    limit: 10,
    offset: 2,
  });
  assert.equal(ListMatriculaAsignaturasRequestDto.from(list), list);
});

test('normaliza listados, publicacion y consulta final de calificaciones', () => {
  const list = ListGradesRequestDto.from({
    detalle_matricula_codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matricula_id: 'MAT-001',
    estudiante_id: '101',
    oferta_curso_id: '202',
    ciclo_acad_codigo: '2026A',
    materia_codigo: 'SW-101',
    paralelo_codigo: 'A',
    estudiante_cedula: '0102030405',
    status: 'published',
    solo_publicadas: 'si',
    limite: '10',
    offset: '3',
  });

  assert.deepEqual({ ...list }, {
    matriculaAsignaturaCodigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    estudianteId: '101',
    ofertaCursoId: '202',
    cicloAcadCodigo: '2026A',
    materiaCodigo: 'SW-101',
    paraleloCodigo: 'A',
    estudianteCedula: '0102030405',
    estado: 'publicado',
    soloPublicados: true,
    limit: 10,
    offset: 3,
  });
  assert.equal(ListGradesRequestDto.from(list), list);

  const publish = PublishGradesRequestDto.from({
    detalleMatriculaCodigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    publicadaPor: '55',
  });

  assert.deepEqual({ ...publish }, {
    matriculaAsignaturaCodigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
    publicadoPor: '55',
  });
  assert.equal(PublishGradesRequestDto.from(publish), publish);

  const finalGrade = FinalGradeRequestDto.from({
    matricula_asignatura_codigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matricula_codigo: 'MAT-001',
  });

  assert.deepEqual({ ...finalGrade }, {
    matriculaAsignaturaCodigo: 'MAT-001:2026A:SW-101:A:DOC-1',
    matriculaCodigo: 'MAT-001',
  });
  assert.equal(FinalGradeRequestDto.from(finalGrade), finalGrade);
});

test('normaliza resumen final de ciclo y exige filtro de estudiante', () => {
  const request = CycleFinalSummaryRequestDto.from({
    ciclo_acad_codigo: '2026A',
    estudiante_id: '101',
    solo_publicados: 'true',
  });

  assert.deepEqual({ ...request }, {
    cicloAcadCodigo: '2026A',
    matriculaCodigo: undefined,
    estudianteId: '101',
    estudianteCedula: undefined,
    soloPublicados: true,
  });
  assert.equal(CycleFinalSummaryRequestDto.from(request), request);
  assert.throws(
    () => CycleFinalSummaryRequestDto.from({ ciclo_acad_codigo: '2026A' }),
    /Indique matricula_codigo/,
  );
});

test('cubre alias y errores de normalizacion comunes', () => {
  assert.equal(normalizeGradeType(undefined, 'otro'), 'otro');
  assert.equal(normalizeGradeType('HOMEWORK'), 'tarea');
  assert.equal(normalizeComponentStatus(undefined, 'activo'), 'activo');
  assert.equal(normalizeComponentStatus('inactive'), 'inactivo');
  assert.equal(normalizeGradeStatus(undefined, 'borrador'), 'borrador');
  assert.equal(normalizeGradeStatus('cancelled'), 'anulado');
  assert.equal(normalizeSubjectEnrollmentStatus(undefined, 'activo'), 'activo');
  assert.equal(normalizeSubjectEnrollmentStatus('activa'), 'activo');
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean('no'), false);
  assert.equal(normalizeLimit('0'), 25);
  assert.equal(normalizeLimit('5'), 5);
  assert.equal(normalizeOffset('-1'), 0);
  assert.equal(normalizeOffset('4'), 4);

  assert.throws(() => normalizeGradeType('quiz'), /Tipo de evaluacion invalido/);
  assert.throws(
    () => normalizeComponentStatus('archivado'),
    /Estado de componente invalido/,
  );
  assert.throws(
    () => normalizeGradeStatus('archivado'),
    /Estado de calificacion invalido/,
  );
  assert.throws(
    () => normalizeSubjectEnrollmentStatus('pendiente'),
    /Estado de matricula-asignatura invalido/,
  );
  assert.throws(() => normalizeBoolean('tal vez'), /Valor booleano invalido/);
});
