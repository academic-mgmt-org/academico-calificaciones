import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import getPool from '../db';
import {
  CreateMatriculaAsignaturaRequestDto,
  CycleFinalSummaryRequestDto,
  CreateEvaluationComponentRequestDto,
  FinalGradeRequestDto,
  ListEvaluationComponentsRequestDto,
  ListGradesRequestDto,
  ListMatriculaAsignaturasRequestDto,
  PublishGradesRequestDto,
  RegisterGradeRequestDto,
  UpdateEvaluationComponentRequestDto,
  UpdateGradeRequestDto,
  normalizeNumericId,
} from './dto/calificaciones.dto';

@Injectable()
export class CalificacionesService {
  constructor() {
    this.pool = getPool();
    this.logger = new Logger(CalificacionesService.name);
  }

  async onModuleInit() {
    await this.ensureSchema();
  }

  async ensureSchema() {
    await this.pool.query(`
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

      CREATE TABLE IF NOT EXISTS academico.calificaciones (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        matricula_asignatura_codigo VARCHAR(200) NOT NULL,
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

      DROP INDEX IF EXISTS academico.uq_calificaciones_matricula_componente_activa;
      DROP INDEX IF EXISTS academico.idx_calificaciones_matricula;
      DROP INDEX IF EXISTS academico.idx_calificaciones_matricula_id;
      DROP INDEX IF EXISTS academico.uq_calificaciones_matricula_codigo_componente_activa;

      ALTER TABLE academico.calificaciones
        ADD COLUMN IF NOT EXISTS matricula_asignatura_codigo VARCHAR(200);

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'academico'
            AND table_name = 'calificaciones'
            AND column_name = 'matricula_id'
        ) THEN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'academico'
              AND table_name = 'calificaciones'
              AND column_name = 'matricula_codigo'
          ) THEN
            ALTER TABLE academico.calificaciones
              ADD COLUMN matricula_codigo VARCHAR(40);
          END IF;

          UPDATE academico.calificaciones
          SET matricula_codigo = matricula_id::text
          WHERE matricula_codigo IS NULL;

          ALTER TABLE academico.calificaciones
            ALTER COLUMN matricula_codigo SET NOT NULL;

          ALTER TABLE academico.calificaciones
            DROP COLUMN matricula_id;
        END IF;
      END $$;

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

      CREATE UNIQUE INDEX IF NOT EXISTS uq_componentes_calificacion_contexto_nombre
        ON academico.componentes_calificacion (
          COALESCE(oferta_curso_id, -1),
          COALESCE(paralelo_id, ''),
          LOWER(nombre)
        );

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

      CREATE INDEX IF NOT EXISTS idx_componentes_calificacion_oferta
        ON academico.componentes_calificacion(oferta_curso_id);
      CREATE INDEX IF NOT EXISTS idx_componentes_calificacion_paralelo
        ON academico.componentes_calificacion(paralelo_id);
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
      CREATE INDEX IF NOT EXISTS idx_calificaciones_matricula_codigo
        ON academico.calificaciones(matricula_codigo);
      CREATE INDEX IF NOT EXISTS idx_calificaciones_estudiante
        ON academico.calificaciones(estudiante_id);
      CREATE INDEX IF NOT EXISTS idx_calificaciones_oferta
        ON academico.calificaciones(oferta_curso_id);
      CREATE INDEX IF NOT EXISTS idx_calificaciones_publicada
        ON academico.calificaciones(publicada);

      ALTER TABLE academico.calificaciones
        DROP CONSTRAINT IF EXISTS uq_calificacion_matricula_evaluacion;

      ALTER TABLE academico.calificaciones
        DROP CONSTRAINT IF EXISTS chk_calificaciones_ponderacion;
      ALTER TABLE academico.calificaciones
        ADD CONSTRAINT chk_calificaciones_ponderacion
          CHECK (ponderacion > 0 AND ponderacion <= 100);

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
    `);
  }

  async createEvaluationComponent(payload = {}) {
    const request = CreateEvaluationComponentRequestDto.from(payload);

    try {
      const { rows } = await this.pool.query(
        `
        INSERT INTO academico.componentes_calificacion (
          oferta_curso_id,
          paralelo_id,
          nombre,
          descripcion,
          tipo,
          ponderacion,
          puntaje_maximo,
          fecha_entrega,
          estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          request.ofertaCursoId || null,
          request.paraleloId || null,
          request.nombre,
          request.descripcion || null,
          request.tipo,
          request.ponderacion,
          request.puntajeMaximo,
          request.fechaEntrega || null,
          request.estado,
        ],
      );

      const component = this.mapComponentRow(rows[0]);
      this.logDomainEvent('EVALUATION_COMPONENT_CREATED', component.id, {
        ofertaCursoId: component.ofertaCursoId,
        paraleloId: component.paraleloId,
      });
      return component;
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async updateEvaluationComponent(payload = {}) {
    const request = UpdateEvaluationComponentRequestDto.from(payload);
    await this.assertComponentExists(this.pool, request.id, true);

    const updates = [];
    const values = [];

    this.addUpdate(updates, values, 'oferta_curso_id', request.ofertaCursoId);
    this.addUpdate(updates, values, 'paralelo_id', request.paraleloId);
    this.addUpdate(updates, values, 'nombre', request.nombre);
    this.addUpdate(updates, values, 'descripcion', request.descripcion);
    this.addUpdate(updates, values, 'tipo', request.tipo);
    this.addUpdate(updates, values, 'ponderacion', request.ponderacion);
    this.addUpdate(updates, values, 'puntaje_maximo', request.puntajeMaximo);
    this.addUpdate(updates, values, 'fecha_entrega', request.fechaEntrega);
    this.addUpdate(updates, values, 'estado', request.estado);

    if (!updates.length) {
      return this.getComponent(request.id, true);
    }

    values.push(request.id);

    try {
      const { rows } = await this.pool.query(
        `
        UPDATE academico.componentes_calificacion
        SET ${updates.join(', ')},
            actualizado_en = NOW()
        WHERE id = $${values.length}
        RETURNING *
        `,
        values,
      );

      const component = this.mapComponentRow(rows[0]);
      this.logDomainEvent('EVALUATION_COMPONENT_UPDATED', component.id, {
        updatedFields: updates.map((update) => update.split('=')[0].trim()),
      });
      return component;
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async listEvaluationComponents(payload = {}) {
    const request = ListEvaluationComponentsRequestDto.from(payload);
    const values = [];
    const where = [];

    if (request.ofertaCursoId) {
      values.push(request.ofertaCursoId);
      where.push(`oferta_curso_id = $${values.length}`);
    }

    if (request.paraleloId) {
      values.push(request.paraleloId);
      where.push(`paralelo_id = $${values.length}`);
    }

    if (request.estado) {
      values.push(request.estado);
      where.push(`estado = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countValues = [...values];
    values.push(request.limit, request.offset);

    const [{ rows }, totalResult] = await Promise.all([
      this.pool.query(
        `
        SELECT *
        FROM academico.componentes_calificacion
        ${whereClause}
        ORDER BY oferta_curso_id NULLS LAST, paralelo_id NULLS LAST, creado_en DESC, id DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
        `,
        values,
      ),
      this.pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM academico.componentes_calificacion
        ${whereClause}
        `,
        countValues,
      ),
    ]);

    return {
      components: rows.map((row) => this.mapComponentRow(row)),
      total: Number(totalResult.rows[0]?.total || 0),
      limit: request.limit,
      offset: request.offset,
    };
  }

  async disableEvaluationComponent(payload = {}) {
    const id = normalizeNumericId(
      payload.id || payload.componentId || payload.component_id,
      'Componente de evaluacion invalido',
    );

    const { rows } = await this.pool.query(
      `
      UPDATE academico.componentes_calificacion
      SET estado = 'inactivo',
          actualizado_en = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException('Componente de evaluacion no encontrado');
    }

    this.logDomainEvent('EVALUATION_COMPONENT_DISABLED', id);
    return {
      success: true,
      message: 'Componente de evaluacion desactivado',
      affectedId: id,
      affected: 1,
    };
  }

  async createMatriculaAsignatura(payload = {}) {
    const request = CreateMatriculaAsignaturaRequestDto.from(payload);
    const codigo =
      request.codigo || this.buildMatriculaAsignaturaCodigo(request);

    try {
      const { rows } = await this.pool.query(
        `
        INSERT INTO academico.matricula_asignaturas (
          codigo,
          matricula_codigo,
          estudiante_id,
          estudiante_cedula,
          oferta_curso_id,
          ciclo_acad_codigo,
          materia_codigo,
          paralelo_codigo,
          docente_cedula,
          nivel_codigo,
          depen_codigo,
          estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        `,
        [
          codigo,
          request.matriculaCodigo,
          request.estudianteId || null,
          request.estudianteCedula || null,
          request.ofertaCursoId || null,
          request.cicloAcadCodigo,
          request.materiaCodigo,
          request.paraleloCodigo,
          request.docenteCedula || null,
          request.nivelCodigo || null,
          request.depenCodigo || null,
          request.estado,
        ],
      );

      const matriculaAsignatura = this.mapMatriculaAsignaturaRow(rows[0]);
      this.logDomainEvent(
        'SUBJECT_ENROLLMENT_CREATED',
        matriculaAsignatura.codigo,
        {
          matriculaCodigo: matriculaAsignatura.matriculaCodigo,
          cicloAcadCodigo: matriculaAsignatura.cicloAcadCodigo,
          materiaCodigo: matriculaAsignatura.materiaCodigo,
        },
      );
      return matriculaAsignatura;
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async listMatriculaAsignaturas(payload = {}) {
    const request = ListMatriculaAsignaturasRequestDto.from(payload);
    const values = [];
    const where = [];

    this.addWhere(where, values, 'codigo', request.codigo);
    this.addWhere(where, values, 'matricula_codigo', request.matriculaCodigo);
    this.addWhere(where, values, 'estudiante_id', request.estudianteId);
    this.addWhere(where, values, 'estudiante_cedula', request.estudianteCedula);
    this.addWhere(where, values, 'oferta_curso_id', request.ofertaCursoId);
    this.addWhere(where, values, 'ciclo_acad_codigo', request.cicloAcadCodigo);
    this.addWhere(where, values, 'materia_codigo', request.materiaCodigo);
    this.addWhere(where, values, 'paralelo_codigo', request.paraleloCodigo);
    this.addWhere(where, values, 'docente_cedula', request.docenteCedula);
    this.addWhere(where, values, 'estado', request.estado);

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countValues = [...values];
    values.push(request.limit, request.offset);

    const [{ rows }, totalResult] = await Promise.all([
      this.pool.query(
        `
        SELECT *
        FROM academico.matricula_asignaturas
        ${whereClause}
        ORDER BY ciclo_acad_codigo DESC, materia_codigo ASC, paralelo_codigo ASC, codigo ASC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
        `,
        values,
      ),
      this.pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM academico.matricula_asignaturas
        ${whereClause}
        `,
        countValues,
      ),
    ]);

    return {
      matriculaAsignaturas: rows.map((row) =>
        this.mapMatriculaAsignaturaRow(row),
      ),
      total: Number(totalResult.rows[0]?.total || 0),
      limit: request.limit,
      offset: request.offset,
    };
  }

  async registerGrade(payload = {}) {
    const request = RegisterGradeRequestDto.from(payload);
    const client = await this.pool.connect();
    let gradeId;

    try {
      await client.query('BEGIN');
      const component = await this.assertComponentExists(
        client,
        request.componenteId,
      );
      const matriculaAsignatura = await this.assertMatriculaAsignaturaExists(
        client,
        request.matriculaAsignaturaCodigo,
      );
      this.assertComponentMatchesMatriculaAsignatura(
        component,
        matriculaAsignatura,
      );
      const estudianteId =
        request.estudianteId || matriculaAsignatura.estudianteId;
      const ofertaCursoId =
        component.ofertaCursoId || matriculaAsignatura.ofertaCursoId;
      const estado = request.publicar ? 'publicada' : 'borrador';

      const { rows } = await client.query(
        `
        INSERT INTO academico.calificaciones (
          matricula_asignatura_codigo,
          matricula_codigo,
          estudiante_id,
          oferta_curso_id,
          componente_id,
          nombre_evaluacion,
          tipo,
          nota,
          ponderacion,
          observacion,
          estado,
          publicada,
          registrada_por
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
        `,
        [
          matriculaAsignatura.codigo,
          matriculaAsignatura.matriculaCodigo,
          estudianteId || null,
          ofertaCursoId || null,
          component.id,
          component.nombre,
          component.tipo,
          request.nota,
          component.ponderacion,
          request.observacion || null,
          estado,
          request.publicar,
          request.registradaPor || null,
        ],
      );

      gradeId = rows[0].id;
      this.logDomainEvent('GRADE_REGISTERED', gradeId, {
        matriculaAsignaturaCodigo: matriculaAsignatura.codigo,
        matriculaCodigo: matriculaAsignatura.matriculaCodigo,
        componenteId: component.id,
        publicada: request.publicar,
      });

      if (request.publicar) {
        const finalGrade = await this.calculateFinalGrade(
          client,
          matriculaAsignatura.codigo,
        );
        await this.syncSubjectEnrollmentFinalGrade(client, finalGrade);
      }

      await client.query('COMMIT');
    } catch (error) {
      await this.rollbackQuietly(client);
      this.handleDatabaseError(error);
    } finally {
      client.release();
    }

    return this.getGrade({ id: String(gradeId) });
  }

  async updateGrade(payload = {}) {
    const request = UpdateGradeRequestDto.from(payload);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const current = await this.assertGradeExists(client, request.id);
      const updates = [];
      const values = [];

      if (request.componenteId) {
        const component = await this.assertComponentExists(
          client,
          request.componenteId,
        );
        this.addUpdate(updates, values, 'componente_id', component.id);
        this.addUpdate(updates, values, 'nombre_evaluacion', component.nombre);
        this.addUpdate(updates, values, 'tipo', component.tipo);
        this.addUpdate(updates, values, 'ponderacion', component.ponderacion);
        this.addUpdate(
          updates,
          values,
          'oferta_curso_id',
          component.ofertaCursoId,
        );
      }

      this.addUpdate(updates, values, 'estudiante_id', request.estudianteId);
      this.addUpdate(updates, values, 'nota', request.nota);
      this.addUpdate(updates, values, 'observacion', request.observacion);
      this.addUpdate(updates, values, 'registrada_por', request.registradaPor);

      if (request.publicada !== undefined) {
        this.addUpdate(updates, values, 'publicada', request.publicada);
        if (!request.estado) {
          this.addUpdate(
            updates,
            values,
            'estado',
            request.publicada ? 'publicada' : 'borrador',
          );
        }
      }

      this.addUpdate(updates, values, 'estado', request.estado);

      if (updates.length) {
        values.push(request.id);
        await client.query(
          `
          UPDATE academico.calificaciones
          SET ${updates.join(', ')},
              actualizado_en = NOW()
          WHERE id = $${values.length}
          `,
          values,
        );

        const finalGrade = await this.calculateFinalGrade(
          client,
          current.matriculaAsignaturaCodigo,
        );
        await this.syncSubjectEnrollmentFinalGrade(client, finalGrade);
        this.logDomainEvent('GRADE_UPDATED', request.id, {
          updatedFields: updates.map((update) => update.split('=')[0].trim()),
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await this.rollbackQuietly(client);
      this.handleDatabaseError(error);
    } finally {
      client.release();
    }

    return this.getGrade({ id: request.id });
  }

  async getGrade(payload = {}) {
    const id = normalizeNumericId(
      payload.id || payload.gradeId || payload.grade_id,
      'Calificacion invalida',
    );
    const { rows } = await this.pool.query(
      `
      SELECT *
      FROM academico.calificaciones
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException('Calificacion no encontrada');
    }

    return this.mapGradeRow(rows[0]);
  }

  async listGrades(payload = {}) {
    const request = ListGradesRequestDto.from(payload);
    const values = [];
    const where = [];

    if (request.matriculaAsignaturaCodigo) {
      values.push(request.matriculaAsignaturaCodigo);
      where.push(`c.matricula_asignatura_codigo = $${values.length}`);
    }

    if (request.matriculaCodigo) {
      values.push(request.matriculaCodigo);
      where.push(`c.matricula_codigo = $${values.length}`);
    }

    if (request.estudianteId) {
      values.push(request.estudianteId);
      where.push(`c.estudiante_id = $${values.length}`);
    }

    if (request.estudianteCedula) {
      values.push(request.estudianteCedula);
      where.push(`ma.estudiante_cedula = $${values.length}`);
    }

    if (request.ofertaCursoId) {
      values.push(request.ofertaCursoId);
      where.push(`c.oferta_curso_id = $${values.length}`);
    }

    if (request.cicloAcadCodigo) {
      values.push(request.cicloAcadCodigo);
      where.push(`ma.ciclo_acad_codigo = $${values.length}`);
    }

    if (request.materiaCodigo) {
      values.push(request.materiaCodigo);
      where.push(`ma.materia_codigo = $${values.length}`);
    }

    if (request.paraleloCodigo) {
      values.push(request.paraleloCodigo);
      where.push(`ma.paralelo_codigo = $${values.length}`);
    }

    if (request.estado) {
      values.push(request.estado);
      where.push(`c.estado = $${values.length}`);
    }

    if (request.soloPublicadas) {
      where.push('c.publicada = TRUE');
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countValues = [...values];
    values.push(request.limit, request.offset);

    const [{ rows }, totalResult] = await Promise.all([
      this.pool.query(
        `
        SELECT c.*
        FROM academico.calificaciones c
        JOIN academico.matricula_asignaturas ma
          ON ma.codigo = c.matricula_asignatura_codigo
        ${whereClause}
        ORDER BY ma.ciclo_acad_codigo DESC, ma.materia_codigo ASC, c.fecha_registro DESC, c.id DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
        `,
        values,
      ),
      this.pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM academico.calificaciones c
        JOIN academico.matricula_asignaturas ma
          ON ma.codigo = c.matricula_asignatura_codigo
        ${whereClause}
        `,
        countValues,
      ),
    ]);

    return {
      grades: rows.map((row) => this.mapGradeRow(row)),
      total: Number(totalResult.rows[0]?.total || 0),
      limit: request.limit,
      offset: request.offset,
    };
  }

  async publishGrades(payload = {}) {
    const request = PublishGradesRequestDto.from(payload);
    const client = await this.pool.connect();
    let affected = 0;
    let finalGrade;

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `
        UPDATE academico.calificaciones
        SET publicada = TRUE,
            estado = 'publicada',
            registrada_por = COALESCE($2, registrada_por),
            actualizado_en = NOW()
        WHERE matricula_asignatura_codigo = $1
          AND estado <> 'anulada'
        `,
        [request.matriculaAsignaturaCodigo, request.publicadaPor || null],
      );
      affected = result.rowCount;

      if (!affected) {
        throw new NotFoundException(
          'No existen calificaciones activas para publicar',
        );
      }

      finalGrade = await this.calculateFinalGrade(
        client,
        request.matriculaAsignaturaCodigo,
      );
      await this.syncSubjectEnrollmentFinalGrade(client, finalGrade);
      await client.query('COMMIT');

      this.logDomainEvent(
        'GRADES_PUBLISHED',
        request.matriculaAsignaturaCodigo,
        {
          affected,
          notaFinal: finalGrade.notaFinal,
        },
      );
    } catch (error) {
      await this.rollbackQuietly(client);
      this.handleDatabaseError(error);
    } finally {
      client.release();
    }

    return {
      success: true,
      message: `Calificaciones publicadas. Nota final: ${finalGrade.notaFinal.toFixed(
        2,
      )}`,
      affectedId: request.matriculaAsignaturaCodigo,
      affected,
    };
  }

  async getFinalGrade(payload = {}) {
    const request = FinalGradeRequestDto.from(payload);
    return this.calculateFinalGrade(
      this.pool,
      request.matriculaAsignaturaCodigo,
    );
  }

  async getCycleFinalSummary(payload = {}) {
    const request = CycleFinalSummaryRequestDto.from(payload);
    const values = [request.cicloAcadCodigo];
    const where = ['ciclo_acad_codigo = $1', "estado <> 'anulada'"];

    if (request.matriculaCodigo) {
      values.push(request.matriculaCodigo);
      where.push(`matricula_codigo = $${values.length}`);
    }

    if (request.estudianteId) {
      values.push(request.estudianteId);
      where.push(`estudiante_id = $${values.length}`);
    }

    if (request.estudianteCedula) {
      values.push(request.estudianteCedula);
      where.push(`estudiante_cedula = $${values.length}`);
    }

    const { rows } = await this.pool.query(
      `
      SELECT *
      FROM academico.matricula_asignaturas
      WHERE ${where.join(' AND ')}
      ORDER BY materia_codigo ASC, paralelo_codigo ASC, codigo ASC
      `,
      values,
    );

    const notasFinales = await Promise.all(
      rows.map((row) => this.calculateFinalGrade(this.pool, row.codigo)),
    );
    const filteredNotasFinales = request.soloPublicadas
      ? notasFinales.filter((finalGrade) => finalGrade.publicada)
      : notasFinales;
    const calificadas = filteredNotasFinales.filter(
      (finalGrade) => finalGrade.estadoAcademico !== 'sin_calificaciones',
    );
    const promedioFinal =
      calificadas.length > 0
        ? Number(
            (
              calificadas.reduce(
                (sum, finalGrade) => sum + finalGrade.notaFinal,
                0,
              ) / calificadas.length
            ).toFixed(2),
          )
        : 0;

    return {
      cicloAcadCodigo: request.cicloAcadCodigo,
      matriculaCodigo: request.matriculaCodigo || '',
      estudianteId: request.estudianteId || '',
      estudianteCedula: request.estudianteCedula || '',
      promedioFinal,
      materias: rows.length,
      materiasCalificadas: calificadas.length,
      notasFinales: filteredNotasFinales,
    };
  }

  addUpdate(updates, values, column, value) {
    if (value === undefined) {
      return;
    }

    values.push(value || value === 0 || value === false ? value : null);
    updates.push(`${column} = $${values.length}`);
  }

  addWhere(where, values, column, value) {
    if (value === undefined) {
      return;
    }

    values.push(value);
    where.push(`${column} = $${values.length}`);
  }

  buildMatriculaAsignaturaCodigo(request) {
    return [
      request.matriculaCodigo,
      request.cicloAcadCodigo,
      request.materiaCodigo,
      request.paraleloCodigo,
      request.docenteCedula || 'SIN-DOCENTE',
    ].join(':');
  }

  assertComponentMatchesMatriculaAsignatura(component, matriculaAsignatura) {
    if (
      component.ofertaCursoId &&
      matriculaAsignatura.ofertaCursoId &&
      component.ofertaCursoId !== matriculaAsignatura.ofertaCursoId
    ) {
      throw new BadRequestException(
        'El componente no pertenece a la oferta de la matricula-asignatura',
      );
    }

    if (
      component.paraleloId &&
      matriculaAsignatura.paraleloCodigo &&
      component.paraleloId !== matriculaAsignatura.paraleloCodigo
    ) {
      throw new BadRequestException(
        'El componente no pertenece al paralelo de la matricula-asignatura',
      );
    }
  }

  async assertComponentExists(client, id, includeInactive = false) {
    const { rows } = await client.query(
      `
      SELECT *
      FROM academico.componentes_calificacion
      WHERE id = $1
        ${includeInactive ? '' : "AND estado = 'activo'"}
      LIMIT 1
      `,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException('Componente de evaluacion no encontrado');
    }

    return this.mapComponentRow(rows[0]);
  }

  async getComponent(id, includeInactive = false) {
    return this.assertComponentExists(this.pool, id, includeInactive);
  }

  async assertMatriculaAsignaturaExists(client, codigo) {
    const { rows } = await client.query(
      `
      SELECT *
      FROM academico.matricula_asignaturas
      WHERE codigo = $1
        AND estado <> 'anulada'
      LIMIT 1
      `,
      [codigo],
    );

    if (!rows.length) {
      throw new NotFoundException('Matricula-asignatura no encontrada');
    }

    return this.mapMatriculaAsignaturaRow(rows[0]);
  }

  async assertGradeExists(client, id) {
    const { rows } = await client.query(
      `
      SELECT *
      FROM academico.calificaciones
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException('Calificacion no encontrada');
    }

    return this.mapGradeRow(rows[0]);
  }

  async resolveEnrollment(client, matriculaCodigo) {
    for (const schemaName of ['academico', 'public']) {
      const exists = await this.tableExists(client, schemaName, 'matriculas');
      if (!exists) {
        continue;
      }
      const compatible = await this.columnsExist(
        client,
        schemaName,
        'matriculas',
        ['codigo', 'estudiante_id', 'oferta_curso_id'],
      );
      if (!compatible) {
        continue;
      }

      const { rows } = await client.query(
        `
        SELECT
          estudiante_id::text AS estudiante_id,
          oferta_curso_id::text AS oferta_curso_id
        FROM ${schemaName}.matriculas
        WHERE codigo = $1
        LIMIT 1
        `,
        [matriculaCodigo],
      );

      if (!rows.length) {
        throw new BadRequestException('Matricula no encontrada');
      }

      return {
        estudianteId: rows[0].estudiante_id || undefined,
        ofertaCursoId: rows[0].oferta_curso_id || undefined,
      };
    }

    return {};
  }

  async calculateFinalGrade(client, matriculaAsignaturaCodigo) {
    const matriculaAsignatura = await this.assertMatriculaAsignaturaExists(
      client,
      matriculaAsignaturaCodigo,
    );
    const { rows } = await client.query(
      `
      SELECT *
      FROM academico.calificaciones
      WHERE matricula_asignatura_codigo = $1
        AND estado <> 'anulada'
      ORDER BY fecha_registro ASC, id ASC
      `,
      [matriculaAsignaturaCodigo],
    );

    if (!rows.length) {
      return {
        matriculaAsignaturaCodigo: matriculaAsignatura.codigo,
        matriculaCodigo: matriculaAsignatura.matriculaCodigo,
        estudianteId: matriculaAsignatura.estudianteId,
        cicloAcadCodigo: matriculaAsignatura.cicloAcadCodigo,
        materiaCodigo: matriculaAsignatura.materiaCodigo,
        paraleloCodigo: matriculaAsignatura.paraleloCodigo,
        notaFinal: 0,
        ponderacionTotal: 0,
        estadoAcademico: 'sin_calificaciones',
        publicada: false,
        grades: [],
      };
    }

    const grades = rows.map((row) => this.mapGradeRow(row));
    const totalWeight = grades.reduce(
      (sum, grade) => sum + Number(grade.ponderacion || 0),
      0,
    );
    const weightedScore = grades.reduce(
      (sum, grade) =>
        sum + Number(grade.nota || 0) * Number(grade.ponderacion || 0),
      0,
    );
    const rawFinal =
      totalWeight > 0
        ? weightedScore / totalWeight
        : grades.reduce((sum, grade) => sum + Number(grade.nota || 0), 0) /
          grades.length;
    const notaFinal = Number(rawFinal.toFixed(2));
    const minimumPassingGrade = Number(
      process.env.CALIFICACIONES_NOTA_APROBACION || '7',
    );

    return {
      matriculaAsignaturaCodigo: matriculaAsignatura.codigo,
      matriculaCodigo: matriculaAsignatura.matriculaCodigo,
      estudianteId:
        grades.find((grade) => grade.estudianteId)?.estudianteId ||
        matriculaAsignatura.estudianteId,
      cicloAcadCodigo: matriculaAsignatura.cicloAcadCodigo,
      materiaCodigo: matriculaAsignatura.materiaCodigo,
      paraleloCodigo: matriculaAsignatura.paraleloCodigo,
      notaFinal,
      ponderacionTotal: Number(totalWeight.toFixed(2)),
      estadoAcademico:
        notaFinal >= minimumPassingGrade ? 'aprobado' : 'reprobado',
      publicada: grades.every((grade) => grade.publicada),
      grades,
    };
  }

  async syncSubjectEnrollmentFinalGrade(client, finalGrade) {
    if (finalGrade.estadoAcademico === 'sin_calificaciones') {
      return;
    }

    await client.query(
      `
      UPDATE academico.matricula_asignaturas
      SET nota_final = $1,
          estado = CASE
            WHEN estado IN ('activa', 'aprobada', 'reprobada')
              THEN $2
            ELSE estado
          END,
          actualizado_en = NOW()
      WHERE codigo = $3
      `,
      [
        finalGrade.notaFinal,
        finalGrade.estadoAcademico,
        finalGrade.matriculaAsignaturaCodigo,
      ],
    );
  }

  async tableExists(client, schemaName, tableName) {
    const { rows } = await client.query('SELECT to_regclass($1) AS regclass', [
      `${schemaName}.${tableName}`,
    ]);
    return Boolean(rows[0]?.regclass);
  }

  async columnsExist(client, schemaName, tableName, columnNames) {
    const { rows } = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = ANY($3)
      `,
      [schemaName, tableName, columnNames],
    );
    const existing = new Set(rows.map((row) => row.column_name));
    return columnNames.every((columnName) => existing.has(columnName));
  }

  mapComponentRow(row) {
    return {
      id: row.id ? String(row.id) : '',
      ofertaCursoId: row.oferta_curso_id ? String(row.oferta_curso_id) : '',
      paraleloId: row.paralelo_id || '',
      nombre: row.nombre || '',
      descripcion: row.descripcion || '',
      tipo: row.tipo || '',
      ponderacion: Number(row.ponderacion || 0),
      puntajeMaximo: Number(row.puntaje_maximo || 0),
      fechaEntrega: this.formatDate(row.fecha_entrega),
      estado: row.estado || '',
      creadoEn: this.formatDateTime(row.creado_en),
      actualizadoEn: this.formatDateTime(row.actualizado_en),
    };
  }

  mapMatriculaAsignaturaRow(row) {
    return {
      codigo: row.codigo || '',
      matriculaCodigo: row.matricula_codigo || '',
      estudianteId: row.estudiante_id ? String(row.estudiante_id) : '',
      estudianteCedula: row.estudiante_cedula || '',
      ofertaCursoId: row.oferta_curso_id ? String(row.oferta_curso_id) : '',
      cicloAcadCodigo: row.ciclo_acad_codigo || '',
      materiaCodigo: row.materia_codigo || '',
      paraleloCodigo: row.paralelo_codigo || '',
      docenteCedula: row.docente_cedula || '',
      nivelCodigo: row.nivel_codigo || '',
      depenCodigo: row.depen_codigo || '',
      estado: row.estado || '',
      notaFinal:
        row.nota_final === null || row.nota_final === undefined
          ? 0
          : Number(row.nota_final),
      creadoEn: this.formatDateTime(row.creado_en),
      actualizadoEn: this.formatDateTime(row.actualizado_en),
    };
  }

  mapGradeRow(row) {
    return {
      id: row.id ? String(row.id) : '',
      matriculaAsignaturaCodigo: row.matricula_asignatura_codigo
        ? String(row.matricula_asignatura_codigo)
        : '',
      matriculaCodigo: row.matricula_codigo ? String(row.matricula_codigo) : '',
      estudianteId: row.estudiante_id ? String(row.estudiante_id) : '',
      ofertaCursoId: row.oferta_curso_id ? String(row.oferta_curso_id) : '',
      componenteId: row.componente_id ? String(row.componente_id) : '',
      nombreEvaluacion: row.nombre_evaluacion || '',
      tipo: row.tipo || '',
      nota: Number(row.nota || 0),
      ponderacion: Number(row.ponderacion || 0),
      observacion: row.observacion || '',
      estado: row.estado || '',
      publicada: Boolean(row.publicada),
      registradaPor: row.registrada_por ? String(row.registrada_por) : '',
      fechaRegistro: this.formatDateTime(row.fecha_registro),
      creadoEn: this.formatDateTime(row.creado_en),
      actualizadoEn: this.formatDateTime(row.actualizado_en),
    };
  }

  formatDate(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  formatDateTime(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  async rollbackQuietly(client) {
    try {
      await client.query('ROLLBACK');
    } catch (error) {
      this.logger.warn({ error: error.message }, 'Rollback fallido');
    }
  }

  handleDatabaseError(error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    if (error instanceof ConflictException) {
      throw error;
    }
    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error?.code === '23505') {
      throw new ConflictException(
        'Ya existe un registro academico con los mismos identificadores',
      );
    }

    if (error?.code === '23503') {
      throw new BadRequestException(
        'La referencia academica indicada no existe',
      );
    }

    if (error?.code === '23514') {
      throw new BadRequestException('Datos de calificacion fuera de rango');
    }

    throw error;
  }

  logDomainEvent(event, entityId, payload = {}) {
    this.logger.log({
      service: 'academico-calificaciones',
      event,
      entityId: String(entityId),
      ...payload,
    });
  }
}
