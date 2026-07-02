const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CreateEvaluationComponentRequestDto,
  RegisterGradeRequestDto,
  UpdateGradeRequestDto,
} = require('../dist/src/calificaciones/dto/calificaciones.dto.js');

test('registra notas en escala de 0 a 10', () => {
  const request = RegisterGradeRequestDto.from({
    matricula_id: '1',
    componente_id: '1',
    nota: 10,
  });

  assert.equal(request.nota, 10);
  assert.throws(
    () =>
      RegisterGradeRequestDto.from({
        matricula_id: '1',
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
