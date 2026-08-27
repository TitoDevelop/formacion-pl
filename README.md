# Alpha Formación · V0.2

Angular 19 + Supabase.

## Novedades V0.2

### Alumno

- Crear test personalizado.
- Elegir uno o varios temas.
- Elegir 10 / 20 / 30 / 50 / 100 preguntas.
- Modo EXAMEN:
  - permite responder libremente;
  - no muestra la corrección;
  - resultado al finalizar.
- Modo PRÁCTICO:
  - corrige inmediatamente al seleccionar;
  - muestra la opción correcta cuando fallas;
  - obliga a responder antes de avanzar.
- Marcar/desmarcar preguntas para repasar.
- Crear tests exclusivamente con preguntas marcadas.
- Biblioteca "Ver tests":
  - tests por temas;
  - exámenes oficiales con municipio/año/nombre.
- Dashboard actualizado.

### Administración

- Control de alumnos.
- Nuevos usuarios quedan `access_enabled = false`.
- El administrador puede:
  - dar acceso;
  - quitar acceso.
- Los alumnos sin autorización ven una pantalla "Acceso pendiente".
- El RLS también impide que un alumno bloqueado consulte preguntas directamente por Supabase.

## IMPORTANTE: actualizar Supabase

Si ya ejecutaste `supabase/schema.sql` de la V0.1:

NO vuelvas a borrar la base.

Ejecuta solamente:

`supabase/migration-v02.sql`

desde Supabase > SQL Editor.

Esto:

- añade `profiles.email`;
- añade `profiles.access_enabled`;
- mantiene acceso a los ADMIN actuales;
- crea `user_review_questions`;
- añade `mode`, `title` y `topic_ids` a los intentos;
- actualiza RLS;
- crea algunos temas iniciales vacíos.

## Temas

La función de tests por temas ya está completamente conectada.

Para que un tema tenga preguntas disponibles, las filas de `questions` deben tener su `topic_id`.

Los exámenes importados en la V0.1 todavía entran sin `topic_id`, porque el HTML universal no contiene directamente el número de tema.

Por eso verás los temas en "Ver tests", pero aparecerán con `0 preguntas` hasta clasificarlas.

La siguiente fase recomendada es el panel de administración:

`Preguntas -> asignar tema`

y después clasificación masiva/asistida.

## Configurar Supabase

`src/environments/environment.ts`

```ts
export const environment = {
  production: false,
  supabaseUrl: 'TU_PROJECT_URL',
  supabaseKey: 'TU_PUBLISHABLE_KEY'
};
```

No uses `service_role`.

## Desarrollo

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

## Git

```bash
git add .
git commit -m "Alpha Formacion v0.2"
git push origin main
```

Netlify leerá el `netlify.toml` existente.

## Flujo de nuevos alumnos

1. Alumno se registra.
2. Confirma email si la confirmación está activada en Supabase.
3. Inicia sesión.
4. Ve "Acceso pendiente".
5. ADMIN -> Control de alumnos.
6. Pulsa "Dar acceso".
7. Alumno cierra sesión / vuelve a entrar.
8. Ya puede usar la plataforma.


## V0.2.1 · Identidad corporativa

- Logo real añadido en `public/alpha-logo.png`.
- Favicon actualizado.
- Nueva paleta corporativa basada en el emblema:
  - azul noche `#0F132F`
  - azul policial `#303867`
  - dorado `#D8BD61`
  - dorado claro `#F0DA86`
  - fondo claro `#F5F6F9`
- Login completamente rediseñado.
- Sidebar corporativo con logo y usuario.
- Botones, tarjetas, progreso, tests y administración adaptados a la nueva identidad.


## V0.2.2 · Importador masivo CSV

El panel `Administración > Importar exámenes` ahora utiliza CSV como formato principal.

Puede importar un único archivo con muchos exámenes.

Columnas obligatorias:

```csv
exam_name,municipality,year,question_number,position,statement,option_a,option_b,option_c,option_d,correct_option
```

Opcionales:

```csv
correct_text,source_id
```

El importador:

- agrupa preguntas por `exam_name + municipality + year`;
- muestra una previsualización;
- cuenta exámenes y preguntas;
- crea los exámenes;
- crea las preguntas;
- crea las cuatro opciones;
- marca la opción correcta;
- relaciona cada pregunta con su examen;
- evita duplicar exámenes importados anteriormente mediante `source_key`.

No requiere ninguna migración nueva de Supabase respecto a V0.2.
