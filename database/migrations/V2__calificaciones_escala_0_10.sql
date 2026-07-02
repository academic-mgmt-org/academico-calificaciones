UPDATE academico.calificaciones
SET nota = ROUND((nota / 10)::numeric, 2)
WHERE nota > 10 AND nota <= 100;

UPDATE academico.componentes_calificacion
SET puntaje_maximo = 10
WHERE puntaje_maximo > 10;

ALTER TABLE academico.componentes_calificacion
    ALTER COLUMN puntaje_maximo SET DEFAULT 10;

ALTER TABLE academico.calificaciones
    DROP CONSTRAINT IF EXISTS chk_calificaciones_nota;
ALTER TABLE academico.calificaciones
    ADD CONSTRAINT chk_calificaciones_nota CHECK (nota BETWEEN 0 AND 10);

ALTER TABLE academico.componentes_calificacion
    DROP CONSTRAINT IF EXISTS chk_componentes_calificacion_puntaje_maximo;
ALTER TABLE academico.componentes_calificacion
    ADD CONSTRAINT chk_componentes_calificacion_puntaje_maximo
    CHECK (puntaje_maximo > 0 AND puntaje_maximo <= 10);

DO $$
BEGIN
    IF to_regclass('academico.matriculas') IS NOT NULL THEN
        UPDATE academico.matriculas
        SET nota_final = ROUND((nota_final / 10)::numeric, 2)
        WHERE nota_final > 10 AND nota_final <= 100;

        ALTER TABLE academico.matriculas
            DROP CONSTRAINT IF EXISTS chk_matriculas_nota_final;
        ALTER TABLE academico.matriculas
            ADD CONSTRAINT chk_matriculas_nota_final
            CHECK (nota_final IS NULL OR (nota_final >= 0 AND nota_final <= 10));
    END IF;
END $$;
