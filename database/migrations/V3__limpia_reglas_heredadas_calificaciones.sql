ALTER TABLE academico.calificaciones
    DROP CONSTRAINT IF EXISTS uq_calificacion_matricula_evaluacion;

DROP INDEX IF EXISTS academico.idx_calificaciones_matricula_id;

ALTER TABLE academico.calificaciones
    DROP CONSTRAINT IF EXISTS chk_calificaciones_ponderacion;
ALTER TABLE academico.calificaciones
    ADD CONSTRAINT chk_calificaciones_ponderacion
    CHECK (ponderacion > 0 AND ponderacion <= 100);
