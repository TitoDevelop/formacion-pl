-- v0.3.2 - Importacion transaccional de preguntas por temas.

create or replace function public.admin_import_topic_questions(topic_groups jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  group_item jsonb;
  question_item jsonb;
  topic_row public.topics%rowtype;
  question_id uuid;
  topic_number integer;
  topic_name text;
  question_statement text;
  question_number text;
  source_name text;
  correct_option text;
  option_values text[];
  letters text[] := array['A', 'B', 'C', 'D'];
  imported_topics integer := 0;
  imported_questions integer := 0;
  skipped_questions integer := 0;
  option_index integer;
  is_official boolean;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede importar preguntas por temas.';
  end if;

  if topic_groups is null or jsonb_typeof(topic_groups) <> 'array' then
    raise exception 'Formato de importacion no valido.';
  end if;

  for group_item in select value from jsonb_array_elements(topic_groups)
  loop
    topic_number := nullif(group_item->>'topic_number', '')::integer;

    if topic_number is null or topic_number <= 0 then
      raise exception 'Numero de tema no valido.';
    end if;

    topic_name := nullif(btrim(coalesce(group_item->>'topic_name', '')), '');

    select *
    into topic_row
    from public.topics
    where number = topic_number;

    if not found then
      insert into public.topics(number, name, active)
      values (topic_number, coalesce(topic_name, 'Tema ' || topic_number), true)
      returning * into topic_row;

      imported_topics := imported_topics + 1;
    end if;

    if jsonb_typeof(group_item->'questions') <> 'array' then
      raise exception 'El tema % no contiene una lista de preguntas valida.', topic_number;
    end if;

    for question_item in select value from jsonb_array_elements(group_item->'questions')
    loop
      question_statement := nullif(btrim(coalesce(question_item->>'statement', '')), '');
      question_number := nullif(btrim(coalesce(question_item->>'question_number', '')), '');
      source_name := coalesce(nullif(btrim(coalesce(question_item->>'source_name', '')), ''), 'Tema ' || topic_number);
      correct_option := upper(nullif(btrim(coalesce(question_item->>'correct_option', '')), ''));
      is_official := coalesce((question_item->>'official')::boolean, true);

      if question_statement is null then
        raise exception 'Pregunta sin enunciado en Tema %, pregunta %.', topic_number, coalesce(question_number, '?');
      end if;

      if exists (
        select 1
        from public.questions
        where topic_id = topic_row.id
          and statement = question_statement
      ) then
        skipped_questions := skipped_questions + 1;
        continue;
      end if;

      if correct_option is null or not (correct_option = any(letters)) then
        raise exception 'Respuesta correcta invalida en Tema %, pregunta %.', topic_number, coalesce(question_number, '?');
      end if;

      option_values := array[
        nullif(btrim(coalesce(question_item->>'option_a', '')), ''),
        nullif(btrim(coalesce(question_item->>'option_b', '')), ''),
        nullif(btrim(coalesce(question_item->>'option_c', '')), ''),
        nullif(btrim(coalesce(question_item->>'option_d', '')), '')
      ];

      for option_index in 1..4 loop
        if option_values[option_index] is null then
          raise exception 'Opcion vacia en Tema %, pregunta %.', topic_number, coalesce(question_number, '?');
        end if;
      end loop;

      insert into public.questions(statement, topic_id, official, source_reference)
      values (
        question_statement,
        topic_row.id,
        is_official,
        source_name || ' - P' || coalesce(question_number, (imported_questions + 1)::text)
      )
      returning id into question_id;

      for option_index in 1..4 loop
        insert into public.question_options(question_id, text, position, is_correct)
        values (
          question_id,
          option_values[option_index],
          option_index,
          letters[option_index] = correct_option
        );
      end loop;

      imported_questions := imported_questions + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'importedTopics', imported_topics,
    'importedQuestions', imported_questions,
    'skippedQuestions', skipped_questions
  );
end;
$$;

grant execute on function public.admin_import_topic_questions(jsonb) to authenticated;
