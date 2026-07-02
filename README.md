# Documento Técnico Core Asset: Calificaciones Service (Gestión de Calificaciones)

## 1. Información General

|Campo|Valor|
|---|---|
|Nombre|Calificaciones Service|
|Tipo|Core Asset|
|Dominio|Gestión Académica|
|Tecnología|Node.js + NestJS + ConnectRPC/gRPC|
|Base de Datos|PostgreSQL|
|Versión|1.0.0|
|Reutilizable|Sí|

---

# 2. Objetivo

Centralizar el registro, publicación y consulta de calificaciones académicas de los estudiantes.

Este servicio será responsable de:

- Definir componentes de evaluación.
- Registrar notas por matrícula académica.
- Actualizar observaciones y puntajes.
- Publicar calificaciones oficiales.
- Calcular nota final ponderada.
- Exponer resultados académicos mediante gRPC.
- Sincronizar la nota final con el Core Asset de Matrículas cuando exista la tabla integrada.

---

# 3. Responsabilidades

## Incluye

✅ Gestión de componentes de evaluación

✅ Registro de calificaciones

✅ Actualización de calificaciones

✅ Consulta por matrícula, estudiante y oferta de curso

✅ Publicación de notas

✅ Cálculo de nota final

✅ Health, readiness y liveness mediante gRPC

---

## No Incluye

❌ Login

❌ JWT

❌ Gestión de usuarios

❌ Creación de matrículas

❌ Catálogo de materias

❌ Notificaciones directas

❌ Solicitudes o reclamos académicos

Estas funciones pertenecen a otros Core Assets.

---

# 4. Ubicación en la Arquitectura

```text
                    Calificaciones Service

                             │

        ┌─────────────────────────────────────┐
        │ Componentes, Notas y Publicación    │
        └─────────────────────────────────────┘

                             │

          ┌────────────┬────────────┬────────────┐
          │            │            │
          ▼            ▼            ▼

     Matrículas     Usuarios    Notificaciones
```

El servicio es la fuente oficial de calificaciones publicadas.

---

# 5. Modelo de Dominio

## Entidades principales

```text
Matricula
    │
    ├── Calificacion
    │       │
    │       └── ComponenteCalificacion
    │
    └── NotaFinal
```

---

# 6. Casos de Uso

## CU-001 Crear Componente de Evaluación

Actor:

```text
Docente
```

Proceso:

```text
1. Registrar nombre, tipo y ponderación
2. Asociar el componente a una oferta/paralelo
3. Validar rangos de ponderación
4. Crear componente activo
```

---

## CU-002 Registrar Calificación

Permite registrar:

- Matrícula
- Estudiante
- Componente
- Nota
- Observación
- Docente registrador

---

## CU-003 Actualizar Calificación

Ejemplo:

```text
Corrección de nota por revisión docente
```

Resultado:

```text
Nota actualizada y nota final recalculada
```

---

## CU-004 Publicar Calificaciones

Publica todas las notas activas de una matrícula.

Resultado:

```text
Estado = publicada
```

---

## CU-005 Consultar Resultado Académico

Búsquedas por:

- Matrícula
- Estudiante
- Oferta de curso
- Estado
- Publicadas

---

# 7. Modelo de Datos

## academico.componentes_calificacion

```sql
CREATE TABLE academico.componentes_calificacion (

 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

 oferta_curso_id BIGINT,

 paralelo_id VARCHAR(80),

 nombre VARCHAR(150) NOT NULL,

 descripcion TEXT,

 tipo VARCHAR(50) NOT NULL,

 ponderacion NUMERIC(5,2) NOT NULL,

 puntaje_maximo NUMERIC(5,2) NOT NULL,

 fecha_entrega DATE,

 estado VARCHAR(20) NOT NULL,

 creado_en TIMESTAMPTZ,

 actualizado_en TIMESTAMPTZ

);
```

---

## academico.calificaciones

```sql
CREATE TABLE academico.calificaciones (

 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

 matricula_asignatura_codigo VARCHAR(200) NOT NULL,

 matricula_codigo VARCHAR(40) NOT NULL,

 estudiante_id BIGINT,

 oferta_curso_id BIGINT,

 componente_id BIGINT NOT NULL,

 nombre_evaluacion VARCHAR(150) NOT NULL,

 tipo VARCHAR(50) NOT NULL,

 nota NUMERIC(5,2) NOT NULL,

 ponderacion NUMERIC(5,2) NOT NULL,

 observacion TEXT,

 estado VARCHAR(20) NOT NULL,

 publicada BOOLEAN NOT NULL,

 registrada_por BIGINT,

 fecha_registro TIMESTAMPTZ,

 creado_en TIMESTAMPTZ,

 actualizado_en TIMESTAMPTZ

);
```

---

# 8. Estados de Calificación

```text
borrador
publicada
anulada
```

## Estados de Componente

```text
activo
inactivo
```

---

# 9. Reglas de Negocio

## RN-001

La nota debe estar entre 0 y 10.

---

## RN-002

La ponderación debe ser mayor a 0 y menor o igual a 100.

---

## RN-003

Una matrícula no puede tener dos calificaciones activas para el mismo componente.

---

## RN-004

No se eliminan calificaciones físicamente.

```text
Estado = anulada
```

---

## RN-005

La publicación cambia las notas activas a estado oficial.

---

# 10. Contrato gRPC

## calificaciones.proto

```protobuf
syntax = "proto3";

service GradingService {

 rpc CreateEvaluationComponent(CreateEvaluationComponentRequest)
     returns(EvaluationComponentResponse);

 rpc UpdateEvaluationComponent(UpdateEvaluationComponentRequest)
     returns(EvaluationComponentResponse);

 rpc ListEvaluationComponents(ListEvaluationComponentsRequest)
     returns(ListEvaluationComponentsResponse);

 rpc DisableEvaluationComponent(ComponentIdRequest)
     returns(GenericResponse);

 rpc RegisterGrade(RegisterGradeRequest)
     returns(GradeResponse);

 rpc UpdateGrade(UpdateGradeRequest)
     returns(GradeResponse);

 rpc GetGrade(GradeIdRequest)
     returns(GradeResponse);

 rpc ListGrades(ListGradesRequest)
     returns(ListGradesResponse);

 rpc PublishGrades(PublishGradesRequest)
     returns(GenericResponse);

 rpc GetFinalGrade(FinalGradeRequest)
     returns(FinalGradeResponse);

}
```

---

## RegisterGradeRequest

```protobuf
message RegisterGradeRequest {

 string matricula_codigo = 1;

 string estudiante_id = 2;

 string componente_id = 3;

 double nota = 4;

 string observacion = 5;

 string registrada_por = 6;

 bool publicar = 7;

 string matricula_asignatura_codigo = 8;

}
```

---

## GradeResponse

```protobuf
message GradeResponse {

 Grade grade = 1;

}
```

---

# 11. Eventos de Dominio

El servicio registra eventos de dominio para integración posterior con auditoría, notificaciones o mensajería.

## EVALUATION_COMPONENT_CREATED

```json
{
  "event":"EVALUATION_COMPONENT_CREATED",
  "entityId":"10"
}
```

---

## GRADE_REGISTERED

```json
{
  "event":"GRADE_REGISTERED",
  "entityId":"25",
  "matriculaAsignaturaCodigo":"MAT-100:2026A:SW-101:A:DOC-1"
}
```

---

## GRADES_PUBLISHED

```json
{
  "event":"GRADES_PUBLISHED",
  "entityId":"100",
  "notaFinal":8.75
}
```

---

# 12. Integraciones

## API Gateway

Consume:

```text
Contrato gRPC calificaciones.v1.GradingService
```

---

## Matrículas Service

Consume/Sincroniza:

```text
matricula_codigo
matricula_asignatura_codigo
ciclo_acad_codigo
materia_codigo
estudiante_id
oferta_curso_id
nota_final por materia
estado académico
```

---

## User Management Service

Consume:

```text
estudiante_id
registrada_por
```

---

## Notification Service

Consume eventos:

```text
GRADES_PUBLISHED
```

Ejemplo:

```text
Notas publicadas
↓
Notificación al estudiante
```

---

## Solicitudes Académicas Service

Consume:

```text
Calificación publicada
Resultado académico
```

---

# 13. Observabilidad

## Logs

```json
{
 "service":"academico-calificaciones",
 "operation":"REGISTER_GRADE",
 "matriculaAsignaturaCodigo":"MAT-100:2026A:SW-101:A:DOC-1"
}
```

---

## Métricas

- Calificaciones registradas.
- Calificaciones publicadas.
- Componentes activos.
- Tiempo promedio de respuesta gRPC.
- Consultas por minuto.

---

# 14. Seguridad

## Transporte y acceso

La comunicación expuesta por el servicio es gRPC/ConnectRPC sobre HTTP/2.

No se exponen controladores REST.

---

## API Key interna

Los métodos de negocio requieren:

```text
x-api-key: CALIFICACIONES_API_KEY
```

Los métodos de health y reflection quedan disponibles para observabilidad e inspección operativa.

---

## Datos sensibles

No exponer:

```text
Secretos
API Keys
Tokens
Credenciales de base de datos
```

---

# 15. Integración DevOps

## Azure Boards

Epic:

```text
Gestión Académica
```

Feature:

```text
Calificaciones y Evaluaciones
```

Historia:

```text
US-601 Registrar calificación
```

---

## Commit

```bash
git commit -m "feat(calificaciones): implementar core asset gRPC AB#601"
```

---

## Pull Request

```text
Implementación Core Asset Calificaciones

Fixes AB#601
```

---

# 16. Quality Gates

|Métrica|Objetivo|
|---|---|
|Cobertura|≥ 85%|
|Vulnerabilidades críticas|0|
|Bugs críticos|0|
|Latencia gRPC|< 150 ms|
|Disponibilidad|99.9%|

---

# 17. Roadmap Evolutivo

### Versión 1.0

- Componentes de evaluación.
- Registro de calificaciones.
- Publicación de notas.
- Cálculo de nota final.

### Versión 1.1

- Historial de cambios de notas.
- Eventos asincrónicos para notificaciones.
- Reportes por curso y docente.

### Versión 2.0

- Rúbricas avanzadas.
- Recalificación formal por solicitud académica.
- Integración completa con analítica académica.

---

# 18. Ubicación dentro de la Plataforma Core Assets

```text
Core Assets

├── Authentication Service
├── User Management Service
├── Matrículas Service
├── Calificaciones Service
├── Solicitudes Académicas Service
├── Notification Service
└── Quality Gates / Observabilidad
```

## Flujo Integrado

```text
Registrar Calificación
      │
      ▼

Calificaciones Service
      │
      ├── GRADE_REGISTERED
      ├── Cálculo ponderado
      ├── Publicación
      ├── Matrículas Service
      └── Notification Service

             ↓

       Resultado académico disponible
```

### Beneficio Estratégico

El **Calificaciones Service** se convierte en el **sistema maestro de evaluación académica**, permitiendo reutilizar la lógica de componentes, notas, publicación y cálculo de resultados en nuevas líneas de producto sin duplicar reglas de negocio.
