# Base de Datos · Alpha Formación

Este documento resume la estructura de Supabase/PostgreSQL de la plataforma, pensada para que otra persona pueda entender y mantener el proyecto sin tener que reconstruir el modelo desde cero.

La referencia técnica principal es `supabase/schema-current.sql`, actualmente generado hasta `v0.2.6`.

## Resumen General

La aplicación usa Supabase para:

- Autenticación de usuarios mediante `auth.users`.
- Perfiles y control de acceso en `public.profiles`.
- Banco de preguntas por temas.
- Exámenes oficiales.
- Tests realizados, respuestas y puntuaciones.
- Preguntas marcadas para repasar.
- Preguntas falladas resueltas manualmente por el alumno.
- Borradores de tests en curso.
- Recursos descargables por tema en Supabase Storage.

El frontend accede a Supabase desde `src/app/core/data.service.ts`.

## Orden De Instalación

Para una base nueva, ejecutar:

```sql
supabase/schema-current.sql
```

Para bases ya existentes, aplicar las migraciones en orden histórico según proceda:

```text
supabase/migration-v02.sql
supabase/migration-test-attempts-temporizador-estadisticas.sql
supabase/migration-v023.sql
supabase/migration-v024-test-drafts.sql
supabase/migration-v025-admin-official-exams.sql
supabase/migration-v026-resolved-failed-questions.sql
```

La migración `v026` crea la tabla que permite quitar manualmente preguntas de “falladas”.

## Tablas Principales

### `profiles`

Perfil público de cada usuario autenticado.

Relación:

- `profiles.id` referencia `auth.users.id`.

Campos clave:

- `email`: correo del usuario.
- `full_name`: nombre visible.
- `role`: `STUDENT` o `ADMIN`.
- `access_enabled`: controla si un alumno puede entrar en la plataforma.

Notas:

- Los usuarios nuevos se crean como `STUDENT`.
- Los alumnos nuevos quedan sin acceso hasta que un administrador active `access_enabled`.
- Los administradores tienen acceso aunque `access_enabled` no esté marcado.

### `topics`

Temas del temario.

Campos clave:

- `number`: número del tema, único.
- `name`: nombre del tema.
- `active`: permite ocultar un tema sin borrarlo.

Uso:

- Biblioteca de tests por temas.
- Tests personalizados.
- Progreso por tema.
- Recursos descargables.

### `questions`

Banco central de preguntas.

Campos clave:

- `statement`: enunciado.
- `explanation`: explicación opcional.
- `topic_id`: tema asociado. Si es `null`, la pregunta no entra en tests por tema.
- `official`: indica si procede de examen oficial o recopilación.
- `source_reference`: referencia visible, por ejemplo `Tema 1 · P204`.

Relaciones:

- `topic_id` referencia `topics.id`.
- Cada pregunta tiene opciones en `question_options`.
- Puede pertenecer a uno o varios exámenes oficiales mediante `official_exam_questions`.

### `question_options`

Opciones de respuesta de cada pregunta.

Campos clave:

- `question_id`: pregunta.
- `text`: texto de la opción.
- `position`: posición 1-4.
- `is_correct`: opción correcta.

Restricciones:

- Una pregunta no puede tener dos opciones con la misma `position`.

### `official_exams`

Cabecera de los exámenes oficiales.

Campos clave:

- `name`: nombre del examen.
- `municipality`: municipio.
- `year`: año.
- `call_name`: convocatoria opcional.
- `source_key`: clave única para evitar importaciones duplicadas.
- `active`: visible para alumnos si está activo.

Uso:

- Biblioteca de exámenes oficiales.
- Intentos oficiales.
- Administración de exámenes.

### `official_exam_questions`

Tabla puente entre exámenes oficiales y preguntas.

Campos clave:

- `exam_id`: examen.
- `question_id`: pregunta.
- `question_number`: número original de la pregunta.
- `position`: orden dentro del examen.

Restricciones:

- Una misma pregunta no se repite dentro del mismo examen.
- Una posición no se repite dentro del mismo examen.

## Tests, Respuestas Y Puntuación

### `test_attempts`

Intentos finalizados de tests, prácticas o exámenes.

Campos clave:

- `user_id`: alumno.
- `exam_id`: solo para oficiales.
- `attempt_type`: tipo de intento.
- `mode`: `EXAM` o `PRACTICE`.
- `title`: título visible.
- `topic_ids`: array de temas incluidos.
- `started_at`, `finished_at`, `duration_seconds`: temporizador.
- `total_questions`, `correct_answers`, `wrong_answers`, `blank_answers`: métricas.
- `score`: nota sobre 10.

Valores de `attempt_type`:

- `CUSTOM`: test personalizado o test completo de tema.
- `TOPIC`: reservado para intentos específicamente de tema.
- `OFFICIAL`: examen oficial.
- `MISTAKES`: repasos de falladas o marcadas.

Regla funcional actual:

- El dashboard global solo debe puntuar `CUSTOM` y `TOPIC`.
- `OFFICIAL` se guarda y se muestra como actividad/examen oficial, pero no entra en la media global.
- `MISTAKES` sirve para repaso y no entra en la puntuación global.

### `test_attempt_answers`

Respuestas de un intento.

Campos clave:

- `attempt_id`: intento.
- `question_id`: pregunta respondida.
- `selected_option_id`: opción elegida, o `null` si queda en blanco.
- `is_correct`: resultado de la respuesta.
- `answered_at`: fecha de registro.

Uso:

- Calcular falladas.
- Progreso por tema.
- Historial y resultados.

## Repaso

### `user_review_questions`

Preguntas marcadas manualmente para repasar.

Campos clave:

- `user_id`: alumno.
- `question_id`: pregunta marcada.
- `created_at`: cuándo se marcó.

Uso:

- Pantalla “Preguntas para repasar”.
- Test de preguntas marcadas.

Notas:

- Marcar o desmarcar no afecta a la puntuación global.
- Los tests de marcadas son repaso, no evaluación.

### `user_resolved_failed_questions`

Preguntas falladas que el alumno decide ocultar manualmente con “Ya la domino”.

Campos clave:

- `user_id`: alumno.
- `question_id`: pregunta.
- `resolved_at`: fecha en la que se marcó como dominada.

Regla funcional:

- Si una pregunta se falló antes de `resolved_at`, se oculta de “Preguntas falladas”.
- Si vuelve a fallarse después de `resolved_at` en un test puntuable, vuelve a aparecer.

Importante:

- Esta tabla no borra historial.
- Solo actúa como filtro personalizado por alumno.
- La migración correspondiente es `supabase/migration-v026-resolved-failed-questions.sql`.

## Borradores

### `test_drafts`

Guarda tests no finalizados para poder continuar más tarde.

Campos clave:

- `user_id`: alumno.
- `draft_key`: clave basada en la URL/ruta.
- `payload`: estado completo del test en JSON.
- `updated_at`: última actualización.

Contenido típico de `payload`:

- Tipo de test.
- Modo.
- Preguntas cargadas.
- Índice actual.
- Respuestas seleccionadas.
- Preguntas ya contestadas.
- Estado del temporizador.

## Recursos De Temas

### `topic_resources`

Metadatos de archivos descargables por tema.

Campos clave:

- `topic_id`: tema.
- `title`: título visible.
- `file_name`: nombre original.
- `storage_path`: ruta en Supabase Storage.
- `mime_type`, `file_size`.
- `created_by`: administrador que subió el archivo.

Storage:

- Bucket privado: `topic-resources`.
- Los alumnos con acceso pueden leer mediante URL firmada.
- Solo admins pueden subir, actualizar o borrar objetos.

## Funciones De Seguridad

### `handle_new_user()`

Trigger ejecutado al crear un usuario en `auth.users`.

Hace:

- Inserta o actualiza `profiles`.
- Copia email.
- Guarda `full_name` si llega desde metadata.
- Crea al usuario como `STUDENT`.
- Deja `access_enabled = false`.

### `is_admin()`

Devuelve `true` si el usuario autenticado tiene `role = 'ADMIN'`.

### `has_platform_access()`

Devuelve `true` si:

- El usuario tiene `access_enabled = true`, o
- El usuario es admin.

Esta función se usa en la mayoría de políticas RLS.

## Row Level Security

Todas las tablas relevantes tienen RLS activado.

Reglas generales:

- Los alumnos solo ven contenido si `has_platform_access()` es `true`.
- Los alumnos solo ven e insertan sus propios intentos, respuestas, marcadas, borradores y falladas resueltas.
- Los administradores pueden gestionar contenido académico.
- Los administradores pueden ver intentos desde políticas específicas.
- Los exámenes oficiales solo son visibles para alumnos si `active = true`; los admins ven también inactivos.

Tablas con gestión admin:

- `topics`
- `questions`
- `question_options`
- `official_exams`
- `official_exam_questions`
- `topic_resources`

Tablas de datos personales del alumno:

- `test_attempts`
- `test_attempt_answers`
- `user_review_questions`
- `user_resolved_failed_questions`
- `test_drafts`

## Flujos Principales

### Alta De Usuario

1. Usuario se registra en Supabase Auth.
2. Trigger `handle_new_user()` crea `profiles`.
3. El usuario queda como `STUDENT` sin acceso.
4. Admin activa acceso desde la pantalla de alumnos.
5. A partir de ahí `has_platform_access()` permite leer contenido.

### Importación De Preguntas Por Tema

1. Admin sube CSV con columnas de tema.
2. La app agrupa por `topic_number`.
3. Busca o crea el tema.
4. Inserta pregunta en `questions` con `topic_id`.
5. Inserta cuatro opciones en `question_options`.
6. Evita duplicados por mismo `statement` dentro del mismo tema.

Estas preguntas entran en:

- Tests personalizados.
- Tests completos de tema.
- Progreso por tema.
- Falladas puntuables.

### Importación De Exámenes Oficiales

1. Admin sube CSV de examen oficial.
2. La app agrupa por `exam_name + municipality + year`.
3. Crea cabecera en `official_exams`.
4. Crea preguntas en `questions`.
5. Crea opciones.
6. Relaciona con `official_exam_questions`.
7. Usa `source_key` para evitar duplicados.

### Test Personalizado O De Tema

1. Se cargan preguntas desde `questions` filtrando por `topic_id`.
2. Las preguntas se barajan en frontend/servicio.
3. Al finalizar, se crea `test_attempts`.
4. Se insertan respuestas en `test_attempt_answers`.
5. El intento cuenta para el dashboard global si `attempt_type` es `CUSTOM` o `TOPIC`.

### Examen Oficial

1. Se cargan preguntas desde `official_exam_questions`.
2. Al finalizar, se crea `test_attempts` con `attempt_type = 'OFFICIAL'`.
3. La nota se calcula con penalización de fallos.
4. No entra en la media global del dashboard.

### Preguntas Marcadas

1. El alumno marca una pregunta.
2. Se inserta en `user_review_questions`.
3. Puede crear un test de repaso.
4. Ese repaso no afecta a la puntuación global.

### Preguntas Falladas

1. Se miran respuestas incorrectas en `test_attempt_answers`.
2. Solo se consideran intentos puntuables: `CUSTOM` y `TOPIC`.
3. Se muestran preguntas falladas recientes sin duplicar.
4. Si el alumno pulsa “Ya la domino”, se guarda en `user_resolved_failed_questions`.
5. Si vuelve a fallarla después en un intento puntuable, reaparece.

## Índices Importantes

- `idx_questions_topic`: acelera consultas por tema.
- `idx_exams_municipality_year`: orden y búsqueda de oficiales.
- `idx_attempts_user_finished`: dashboard e historial por alumno.
- `idx_attempt_answers_attempt`: respuestas de un intento.
- `idx_attempt_answers_question`: progreso y falladas por pregunta.
- `idx_review_user_created`: preguntas marcadas recientes.
- `idx_resolved_failed_user_question`: falladas resueltas por alumno.
- `idx_test_drafts_user_updated`: borradores recientes.
- `idx_topic_resources_topic`: recursos por tema.

## Notas Para Mantenimiento

- No usar claves `service_role` en el frontend.
- Cualquier tabla nueva de datos de alumno debe llevar RLS por `auth.uid()`.
- Cualquier tabla nueva de contenido académico debe comprobar `has_platform_access()` para lectura y `is_admin()` para escritura.
- Si se cambia la lógica de puntuación, revisar:
  - `DataService.finishAttempt()`
  - `DashboardComponent`
  - `DataService.getTopicProgress()`
  - `DataService.failedQuestions()`
- Si se cambia la definición de “fallada”, revisar también `user_resolved_failed_questions`.
- Si se añade una migración, actualizar también `supabase/schema-current.sql`.

