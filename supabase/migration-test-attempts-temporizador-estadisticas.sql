-- Alpha Formación
-- Ampliación de test_attempts: temporizador y estadísticas
-- 2026-09-01

ALTER TABLE public.test_attempts
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS finished_at timestamptz,
    ADD COLUMN IF NOT EXISTS duration_seconds integer,
    ADD COLUMN IF NOT EXISTS answered_count integer,
    ADD COLUMN IF NOT EXISTS correct_count integer,
    ADD COLUMN IF NOT EXISTS wrong_count integer;

COMMENT ON COLUMN public.test_attempts.started_at
    IS 'Fecha y hora de inicio del test o examen.';

COMMENT ON COLUMN public.test_attempts.finished_at
    IS 'Fecha y hora de finalización del test o examen.';

COMMENT ON COLUMN public.test_attempts.duration_seconds
    IS 'Duración total del intento expresada en segundos.';

COMMENT ON COLUMN public.test_attempts.answered_count
    IS 'Número de preguntas respondidas durante el intento.';

COMMENT ON COLUMN public.test_attempts.correct_count
    IS 'Número de respuestas correctas del intento.';

COMMENT ON COLUMN public.test_attempts.wrong_count
    IS 'Número de respuestas incorrectas del intento.';

-- Comprobación
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'test_attempts'
  AND column_name IN (
      'started_at',
      'finished_at',
      'duration_seconds',
      'answered_count',
      'correct_count',
      'wrong_count'
  )
ORDER BY column_name;
