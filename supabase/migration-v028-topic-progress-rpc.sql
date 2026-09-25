-- v0.2.8 - Calcula respuestas de progreso por tema en BBDD.
-- Evita enviar cientos de question_id en query string desde PostgREST.

create or replace function public.topic_progress_answers(
  p_topic_id uuid,
  p_official_filter text default 'all'
)
returns table (
  question_id uuid,
  is_correct boolean,
  answered_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (taa.question_id)
    taa.question_id,
    taa.is_correct,
    taa.answered_at
  from public.test_attempt_answers taa
  join public.test_attempts ta on ta.id = taa.attempt_id
  join public.questions q on q.id = taa.question_id
  where public.has_platform_access()
    and ta.user_id = auth.uid()
    and ta.attempt_type in ('CUSTOM', 'TOPIC')
    and q.topic_id = p_topic_id
    and (
      p_official_filter = 'all'
      or (p_official_filter = 'official' and q.official = true)
      or (p_official_filter = 'unofficial' and q.official = false)
    )
  order by taa.question_id, taa.answered_at desc;
$$;

grant execute on function public.topic_progress_answers(uuid, text) to authenticated;
