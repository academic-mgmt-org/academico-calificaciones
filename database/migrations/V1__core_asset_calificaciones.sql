CREATE SCHEMA IF NOT EXISTS academico;

CREATE TABLE IF NOT EXISTS academico.componentes_calificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    oferta_curso_id BIGINT,
    paralelo_id VARCHAR(80),
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL DEFAULT 'otro',
    ponderacion NUMERIC(5,2) NOT NULL,
    puntaje_maximo NUMERIC(5,2) NOT NULL DEFAULT 10,
    fecha_entrega DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_componentes_calificacion_tipo
        CHECK (tipo IN ('tarea', 'leccion', 'examen', 'proyecto', 'participacion', 'otro')),
    CONSTRAINT chk_componentes_calificacion_ponderacion
        CHECK (ponderacion > 0 AND ponderacion <= 100),
    CONSTRAINT chk_componentes_calificacion_puntaje_maximo
        CHECK (puntaje_maximo > 0 AND puntaje_maximo <= 10),
    CONSTRAINT chk_componentes_calificacion_estado
        CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE IF NOT EXISTS academico.calificaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    matricula_codigo VARCHAR(40) NOT NULL,
    estudiante_id BIGINT,
    oferta_curso_id BIGINT,
    componente_id BIGINT NOT NULL
        REFERENCES academico.componentes_calificacion(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    nombre_evaluacion VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    nota NUMERIC(5,2) NOT NULL,
    ponderacion NUMERIC(5,2) NOT NULL,
    observacion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    publicada BOOLEAN NOT NULL DEFAULT FALSE,
    registrada_por BIGINT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_calificaciones_tipo
        CHECK (tipo IN ('tarea', 'leccion', 'examen', 'proyecto', 'participacion', 'otro')),
    CONSTRAINT chk_calificaciones_nota
        CHECK (nota BETWEEN 0 AND 10),
    CONSTRAINT chk_calificaciones_ponderacion
        CHECK (ponderacion > 0 AND ponderacion <= 100),
    CONSTRAINT chk_calificaciones_estado
        CHECK (estado IN ('borrador', 'publicada', 'anulada'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_componentes_calificacion_contexto_nombre
    ON academico.componentes_calificacion (
        COALESCE(oferta_curso_id, -1),
        COALESCE(paralelo_id, ''),
        LOWER(nombre)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_calificaciones_matricula_codigo_componente_activa
    ON academico.calificaciones (matricula_codigo, componente_id)
    WHERE estado <> 'anulada';

CREATE INDEX IF NOT EXISTS idx_componentes_calificacion_oferta
    ON academico.componentes_calificacion(oferta_curso_id);
CREATE INDEX IF NOT EXISTS idx_componentes_calificacion_paralelo
    ON academico.componentes_calificacion(paralelo_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_matricula_codigo
    ON academico.calificaciones(matricula_codigo);
CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante
    ON academico.calificaciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_oferta
    ON academico.calificaciones(oferta_curso_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_publicada
    ON academico.calificaciones(publicada);
