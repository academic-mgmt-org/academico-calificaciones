CREATE TABLE IF NOT EXISTS academico.matricula_asignaturas (
    codigo VARCHAR(200) PRIMARY KEY,
    matricula_codigo VARCHAR(40) NOT NULL,
    estudiante_id BIGINT,
    estudiante_cedula VARCHAR(80),
    oferta_curso_id BIGINT,
    ciclo_acad_codigo VARCHAR(40) NOT NULL,
    materia_codigo VARCHAR(120) NOT NULL,
    paralelo_codigo VARCHAR(40) NOT NULL,
    docente_cedula VARCHAR(80),
    nivel_codigo VARCHAR(40),
    depen_codigo VARCHAR(40),
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    nota_final NUMERIC(5,2),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_matricula_asignaturas_estado
        CHECK (estado IN ('activa', 'aprobada', 'reprobada', 'anulada')),
    CONSTRAINT chk_matricula_asignaturas_nota_final
        CHECK (nota_final IS NULL OR (nota_final >= 0 AND nota_final <= 10))
);

ALTER TABLE academico.calificaciones
    ADD COLUMN IF NOT EXISTS matricula_asignatura_codigo VARCHAR(200);

INSERT INTO academico.matricula_asignaturas (
    codigo,
    matricula_codigo,
    estudiante_id,
    oferta_curso_id,
    ciclo_acad_codigo,
    materia_codigo,
    paralelo_codigo
)
SELECT DISTINCT
    CONCAT('LEGACY:', matricula_codigo),
    matricula_codigo,
    estudiante_id,
    oferta_curso_id,
    'SIN-CICLO',
    'SIN-MATERIA',
    'SIN-PARALELO'
FROM academico.calificaciones
WHERE matricula_asignatura_codigo IS NULL
ON CONFLICT (codigo) DO NOTHING;

UPDATE academico.calificaciones
SET matricula_asignatura_codigo = CONCAT('LEGACY:', matricula_codigo)
WHERE matricula_asignatura_codigo IS NULL;

ALTER TABLE academico.calificaciones
    ALTER COLUMN matricula_asignatura_codigo SET NOT NULL;

ALTER TABLE academico.calificaciones
    DROP CONSTRAINT IF EXISTS fk_calificaciones_matricula_asignatura;

ALTER TABLE academico.calificaciones
    ADD CONSTRAINT fk_calificaciones_matricula_asignatura
        FOREIGN KEY (matricula_asignatura_codigo)
        REFERENCES academico.matricula_asignaturas(codigo)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

DROP INDEX IF EXISTS academico.uq_calificaciones_matricula_codigo_componente_activa;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matricula_asignaturas_contexto
    ON academico.matricula_asignaturas (
        matricula_codigo,
        ciclo_acad_codigo,
        materia_codigo,
        paralelo_codigo,
        (COALESCE(docente_cedula, ''))
    )
    WHERE estado <> 'anulada';

CREATE UNIQUE INDEX IF NOT EXISTS uq_calificaciones_matricula_asignatura_componente_activa
    ON academico.calificaciones (matricula_asignatura_codigo, componente_id)
    WHERE estado <> 'anulada';

CREATE INDEX IF NOT EXISTS idx_matricula_asignaturas_matricula
    ON academico.matricula_asignaturas(matricula_codigo);
CREATE INDEX IF NOT EXISTS idx_matricula_asignaturas_estudiante
    ON academico.matricula_asignaturas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_matricula_asignaturas_estudiante_cedula
    ON academico.matricula_asignaturas(estudiante_cedula);
CREATE INDEX IF NOT EXISTS idx_matricula_asignaturas_ciclo
    ON academico.matricula_asignaturas(ciclo_acad_codigo);
CREATE INDEX IF NOT EXISTS idx_matricula_asignaturas_materia
    ON academico.matricula_asignaturas(materia_codigo);
CREATE INDEX IF NOT EXISTS idx_calificaciones_matricula_asignatura
    ON academico.calificaciones(matricula_asignatura_codigo);
