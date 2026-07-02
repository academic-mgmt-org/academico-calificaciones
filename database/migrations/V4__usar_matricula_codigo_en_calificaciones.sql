DROP INDEX IF EXISTS academico.uq_calificaciones_matricula_componente_activa;
DROP INDEX IF EXISTS academico.idx_calificaciones_matricula;
DROP INDEX IF EXISTS academico.idx_calificaciones_matricula_id;

ALTER TABLE academico.calificaciones
    ADD COLUMN IF NOT EXISTS matricula_codigo VARCHAR(40);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'academico'
          AND table_name = 'calificaciones'
          AND column_name = 'matricula_id'
    ) THEN
        UPDATE academico.calificaciones
        SET matricula_codigo = matricula_id::text
        WHERE matricula_codigo IS NULL;
    END IF;
END $$;

ALTER TABLE academico.calificaciones
    ALTER COLUMN matricula_codigo SET NOT NULL;

ALTER TABLE academico.calificaciones
    DROP COLUMN IF EXISTS matricula_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_calificaciones_matricula_codigo_componente_activa
    ON academico.calificaciones (matricula_codigo, componente_id)
    WHERE estado <> 'anulada';

CREATE INDEX IF NOT EXISTS idx_calificaciones_matricula_codigo
    ON academico.calificaciones(matricula_codigo);
