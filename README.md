# Alpha Formacion

Angular 19 + Supabase.

## Estado Actual

La referencia consolidada de base de datos esta en:

- `supabase/schema-current.sql`

La documentacion funcional de la base de datos esta en:

- `DATABASE.md`

Para una base nueva, ejecuta `supabase/schema-current.sql` desde Supabase > SQL Editor.

Para una base existente, aplica las migraciones pendientes en orden. La ultima migracion anadida es:

- `supabase/migration-v026-resolved-failed-questions.sql`

Esta migracion permite que un alumno quite manualmente preguntas de "falladas" mediante la accion "Ya la domino".

## Funcionalidad Principal

### Alumno

- Crear tests personalizados.
- Elegir uno o varios temas.
- Elegir cantidad de preguntas.
- Realizar tests en modo `EXAM` o `PRACTICE`.
- Marcar y desmarcar preguntas para repasar.
- Crear tests solo con preguntas marcadas.
- Ver preguntas falladas.
- Quitar manualmente preguntas de falladas si ya las domina.
- Acceder a biblioteca de tests por temas.
- Realizar examenes oficiales.
- Ver dashboard con progreso y actividad reciente.

### Administracion

- Control de alumnos.
- Nuevos usuarios quedan con `access_enabled = false`.
- El administrador puede dar o quitar acceso.
- Importacion masiva de examenes oficiales por CSV.
- Importacion masiva de preguntas por tema por CSV.
- Gestion de examenes oficiales activos/inactivos.
- Gestion de recursos descargables por tema.

## Reglas De Puntuacion

El dashboard global solo puntua:

- Tests personalizados.
- Tests por tema.

No puntuan en el dashboard global:

- Examenes oficiales.
- Repasos de preguntas marcadas.
- Repasos de preguntas falladas.

Los examenes oficiales mantienen su nota e historial, pero se tratan como resultados independientes y no entran en la media global.

Las preguntas falladas:

- se calculan solo desde intentos puntuables;
- pueden quitarse manualmente con "Ya la domino";
- reaparecen si el alumno vuelve a fallarlas despues en un test puntuable.

## Configurar Supabase

Configura el cliente en:

```text
src/environments/environment.ts
```

Ejemplo:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'TU_PROJECT_URL',
  supabaseKey: 'TU_PUBLISHABLE_KEY'
};
```

No uses `service_role` en el frontend.

## Migraciones

Para bases existentes, aplica segun lo que ya tenga instalado:

```text
supabase/migration-v02.sql
supabase/migration-test-attempts-temporizador-estadisticas.sql
supabase/migration-v023.sql
supabase/migration-v024-test-drafts.sql
supabase/migration-v025-admin-official-exams.sql
supabase/migration-v026-resolved-failed-questions.sql
```

Resumen:

- `migration-v02.sql`: perfiles, control de acceso, preguntas marcadas, modos de intento y RLS.
- `migration-test-attempts-temporizador-estadisticas.sql`: temporizador y estadisticas de intentos.
- `migration-v023.sql`: recursos por tema y Storage privado.
- `migration-v024-test-drafts.sql`: borradores de tests.
- `migration-v025-admin-official-exams.sql`: administracion/visibilidad de examenes oficiales.
- `migration-v026-resolved-failed-questions.sql`: preguntas falladas resueltas manualmente.

## Documentacion De Base De Datos

Consulta:

```text
DATABASE.md
```

Incluye:

- tablas;
- relaciones;
- RLS;
- funciones de seguridad;
- flujos principales;
- reglas de puntuacion;
- notas de mantenimiento.

## Importacion CSV

### Examenes oficiales

Columnas obligatorias:

```csv
exam_name,municipality,year,question_number,position,statement,option_a,option_b,option_c,option_d,correct_option
```

Columnas opcionales:

```csv
correct_text,source_id
```

El importador:

- agrupa por `exam_name + municipality + year`;
- crea examenes oficiales;
- crea preguntas y opciones;
- marca la opcion correcta;
- relaciona preguntas con el examen;
- evita duplicados mediante `source_key`.

### Preguntas por tema

El CSV de temas se identifica por `topic_number`.

En la importacion por tema:

- se busca `topics.id` mediante `topics.number`;
- si el tema no existe, se crea;
- cada pregunta se inserta con `questions.topic_id`;
- se crean las opciones;
- se marca `is_correct`;
- si ya existe el mismo enunciado en el mismo tema, se omite.

Gracias a `topic_id`, las preguntas importadas entran automaticamente en:

- tests personalizados;
- tests por temas;
- ficha y progreso del tema;
- estadisticas por tema;
- preguntas falladas puntuables.

## Flujo De Nuevos Alumnos

1. Alumno se registra.
2. Confirma email si la confirmacion esta activada en Supabase.
3. Inicia sesion.
4. Ve "Acceso pendiente".
5. Admin entra en control de alumnos.
6. Admin pulsa "Dar acceso".
7. Alumno cierra sesion o vuelve a entrar.
8. Ya puede usar la plataforma.

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Arrancar en local:

```bash
npm start
```

Build:

```bash
npm run build
```

Comprobacion TypeScript sin generar build:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

## Deploy

Netlify lee la configuracion existente en:

```text
netlify.toml
```

## Git

Ejemplo:

```bash
git add .
git commit -m "Actualizar Alpha Formacion"
git push origin main
```

