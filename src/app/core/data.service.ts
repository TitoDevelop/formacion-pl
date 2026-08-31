import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import {
  ExamQuestionRow,
  ImportGroup,
  OfficialExam,
  Question,
  TestMode,
  Topic,
  UniversalQuestion
} from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private db: SupabaseService, private auth: AuthService) {}

  async listTopics(): Promise<Topic[]> {
    const { data, error } = await this.db.client
      .from('topics')
      .select('id,number,name,active')
      .eq('active', true)
      .order('number', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data ?? []) as Topic[];
  }

  async countTopicQuestions(topicIds: string[]): Promise<number> {
    if (!topicIds.length) return 0;

    const { count, error } = await this.db.client
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .in('topic_id', topicIds);

    if (error) throw error;
    return count ?? 0;
  }

  async listOfficialExams(): Promise<OfficialExam[]> {
    const { data, error } = await this.db.client
      .from('official_exams')
      .select('*')
      .order('year', { ascending: false })
      .order('municipality');

    if (error) throw error;
    return (data ?? []) as OfficialExam[];
  }

  async getExam(examId: string): Promise<OfficialExam> {
    const { data, error } = await this.db.client
      .from('official_exams')
      .select('*')
      .eq('id', examId)
      .single();

    if (error) throw error;
    return data as OfficialExam;
  }

  async getExamQuestions(examId: string): Promise<ExamQuestionRow[]> {
    const { data, error } = await this.db.client
      .from('official_exam_questions')
      .select(`
        exam_id,
        question_id,
        question_number,
        position,
        questions (
          id, statement, explanation, topic_id, official, source_reference,
          question_options (id, question_id, text, position, is_correct)
        )
      `)
      .eq('exam_id', examId)
      .order('position');

    if (error) throw error;
    return (data ?? []) as unknown as ExamQuestionRow[];
  }

  async getCustomQuestions(topicIds: string[], count?: number): Promise<Question[]> {
    if (!topicIds.length) return [];

    const pageSize = 1000;
    const loaded: Question[] = [];
    let from = 0;

    do {
      const { data, error } = await this.db.client
        .from('questions')
        .select(`
          id, statement, explanation, topic_id, official, source_reference,
          question_options (id, question_id, text, position, is_correct)
        `)
        .in('topic_id', topicIds)
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = (data ?? []) as Question[];
      loaded.push(...page);
      from += page.length;
      if (page.length < pageSize) break;
    } while (count === undefined);

    const questions = this.shuffle(loaded);
    return count === undefined ? questions : questions.slice(0, count);
  }

  async getReviewQuestions(count: number): Promise<Question[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data: marks, error } = await this.db.client
      .from('user_review_questions')
      .select('question_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const ids = (marks ?? []).map(x => x.question_id);
    if (!ids.length) return [];

    const { data, error: qError } = await this.db.client
      .from('questions')
      .select(`
        id, statement, explanation, topic_id, official, source_reference,
        question_options (id, question_id, text, position, is_correct)
      `)
      .in('id', ids);

    if (qError) throw qError;

    const byId = new Map(((data ?? []) as Question[]).map(q => [q.id, q]));
    return ids.map(id => byId.get(id)).filter(Boolean).slice(0, count) as Question[];
  }

  async reviewQuestionIds(questionIds: string[]): Promise<Set<string>> {
    const userId = this.auth.user()?.id;
    if (!userId || !questionIds.length) return new Set();

    const { data, error } = await this.db.client
      .from('user_review_questions')
      .select('question_id')
      .eq('user_id', userId)
      .in('question_id', questionIds);

    if (error) throw error;
    return new Set((data ?? []).map(x => x.question_id));
  }

  async reviewCount(): Promise<number> {
    const userId = this.auth.user()?.id;
    if (!userId) return 0;

    const { count, error } = await this.db.client
      .from('user_review_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count ?? 0;
  }

  async setReview(questionId: string, marked: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('No hay sesión activa.');

    if (marked) {
      const { error } = await this.db.client
        .from('user_review_questions')
        .upsert({ user_id: userId, question_id: questionId });
      if (error) throw error;
    } else {
      const { error } = await this.db.client
        .from('user_review_questions')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);
      if (error) throw error;
    }
  }

  async finishAttempt(
    examId: string | null,
    attemptType: 'OFFICIAL' | 'TOPIC' | 'MISTAKES' | 'CUSTOM',
    mode: TestMode,
    title: string,
    topicIds: string[] | null,
    questions: { questionId: string; selectedOptionId: string | null; correct: boolean }[]
  ): Promise<string> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('No hay sesión activa.');

    const correct = questions.filter(q => q.correct).length;
    const blank = questions.filter(q => !q.selectedOptionId).length;
    const wrong = questions.length - correct - blank;
    const score = questions.length
      ? Number(((correct / questions.length) * 10).toFixed(2))
      : 0;

    const { data: attempt, error } = await this.db.client
      .from('test_attempts')
      .insert({
        user_id: userId,
        exam_id: examId,
        attempt_type: attemptType,
        mode,
        title,
        topic_ids: topicIds,
        finished_at: new Date().toISOString(),
        total_questions: questions.length,
        correct_answers: correct,
        wrong_answers: wrong,
        blank_answers: blank,
        score
      })
      .select('id')
      .single();

    if (error) throw error;

    const answers = questions.map(q => ({
      attempt_id: attempt.id,
      question_id: q.questionId,
      selected_option_id: q.selectedOptionId,
      is_correct: q.correct
    }));

    if (answers.length) {
      const { error: answerError } = await this.db.client
        .from('test_attempt_answers')
        .insert(answers);

      if (answerError) throw answerError;
    }

    return attempt.id;
  }

  async getAttempt(attemptId: string) {
    const { data, error } = await this.db.client
      .from('test_attempts')
      .select('*, official_exams(name, municipality, year)')
      .eq('id', attemptId)
      .single();

    if (error) throw error;
    return data;
  }

  async weeklyStats() {
    const from = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data, error } = await this.db.client
      .from('test_attempts')
      .select('id,title,mode,total_questions,correct_answers,wrong_answers,score,finished_at')
      .gte('finished_at', from)
      .order('finished_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async failedQuestions() {
    const { data, error } = await this.db.client
      .from('test_attempt_answers')
      .select(`
        question_id,
        answered_at,
        questions (
          id, statement, explanation, topic_id, official, source_reference,
          question_options (id, question_id, text, position, is_correct)
        )
      `)
      .eq('is_correct', false)
      .order('answered_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const seen = new Set<string>();
    const unique: any[] = [];

    for (const row of data ?? []) {
      if (!seen.has(row.question_id)) {
        seen.add(row.question_id);
        unique.push(row.questions);
      }
    }

    return unique;
  }

  async adminListStudents() {
    const { data, error } = await this.db.client
      .from('profiles')
      .select('id,email,full_name,role,access_enabled,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async adminSetAccess(profileId: string, enabled: boolean) {
    const { error } = await this.db.client
      .from('profiles')
      .update({ access_enabled: enabled })
      .eq('id', profileId);

    if (error) throw error;
  }


  async getTopic(topicId: string): Promise<Topic> {
    const { data, error } = await this.db.client.from('topics')
      .select('id,number,name,active').eq('id', topicId).single();
    if (error) throw error;
    return data as Topic;
  }

  async getTopicProgress(topicId: string) {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('No hay sesión activa.');

    const totalQuestions = await this.countTopicQuestions([topicId]);
    const { data: topicQuestions, error: tqError } = await this.db.client
      .from('questions').select('id').eq('topic_id', topicId);
    if (tqError) throw tqError;
    const questionIds = (topicQuestions ?? []).map(q => q.id);
    if (!totalQuestions || !questionIds.length) return { totalQuestions:0, answeredQuestions:0, correctAnswers:0, wrongAnswers:0, accuracy:0, completion:0, failedQuestionIds:[], attempts:[] };

    const { data: attempts, error: aError } = await this.db.client
      .from('test_attempts')
      .select('id,title,mode,total_questions,correct_answers,wrong_answers,blank_answers,score,finished_at,topic_ids')
      .eq('user_id', userId).contains('topic_ids', [topicId])
      .order('finished_at', { ascending: false }).limit(30);
    if (aError) throw aError;

    const { data: answers, error: ansError } = await this.db.client
      .from('test_attempt_answers')
      .select('question_id,is_correct,answered_at,test_attempts!inner(user_id)')
      .eq('test_attempts.user_id', userId)
      .in('question_id', questionIds)
      .order('answered_at', { ascending: true });
    if (ansError) throw ansError;

    const latest = new Map<string, { correct: boolean; answered_at: string }>();
    for (const ans of answers ?? []) latest.set(ans.question_id, { correct: ans.is_correct, answered_at: ans.answered_at });
    const answeredQuestions = latest.size;
    const correctAnswers = [...latest.values()].filter(x => x.correct).length;
    const wrongAnswers = answeredQuestions - correctAnswers;
    const failedQuestionIds = [...latest.entries()].filter(([,v]) => !v.correct).map(([id]) => id);

    return {
      totalQuestions, answeredQuestions, correctAnswers, wrongAnswers,
      accuracy: answeredQuestions ? Math.round(correctAnswers / answeredQuestions * 100) : 0,
      completion: totalQuestions ? Math.min(100, Math.round(answeredQuestions / totalQuestions * 100)) : 0,
      failedQuestionIds,
      attempts: attempts ?? []
    };
  }

  async getTopicFailedQuestions(topicId: string, count: number): Promise<Question[]> {
    const progress = await this.getTopicProgress(topicId);
    const ids = progress.failedQuestionIds.slice(0, Math.max(1, count));
    if (!ids.length) return [];
    const { data, error } = await this.db.client.from('questions').select(`
      id, statement, explanation, topic_id, official, source_reference,
      question_options (id, question_id, text, position, is_correct)
    `).in('id', ids);
    if (error) throw error;
    const byId = new Map(((data ?? []) as Question[]).map(q => [q.id, q]));
    return ids.map(id => byId.get(id)).filter(Boolean) as Question[];
  }

  async listTopicResources(topicId: string) {
    const { data, error } = await this.db.client.from('topic_resources')
      .select('*').eq('topic_id', topicId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getTopicResourceDownloadUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.db.client.storage.from('topic-resources').createSignedUrl(storagePath, 600);
    if (error) throw error;
    if (!data.signedUrl) throw new Error('No se pudo crear el enlace de descarga.');
    return data.signedUrl;
  }

  async adminUploadTopicResource(topicId: string, title: string, file: File) {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('No hay sesión activa.');
    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storagePath = `${topicId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await this.db.client.storage.from('topic-resources').upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await this.db.client.from('topic_resources').insert({
      topic_id: topicId, title: title.trim() || file.name, file_name: file.name,
      storage_path: storagePath, mime_type: file.type || null, file_size: file.size, created_by: userId
    }).select('*').single();
    if (error) {
      await this.db.client.storage.from('topic-resources').remove([storagePath]);
      throw error;
    }
    return data;
  }

  async adminDeleteTopicResource(resource: any) {
    const { error: storageError } = await this.db.client.storage.from('topic-resources').remove([resource.storage_path]);
    if (storageError) throw storageError;
    const { error } = await this.db.client.from('topic_resources').delete().eq('id', resource.id);
    if (error) throw error;
  }

  parseUniversalHtml(html: string): ImportGroup[] {
    const match = html.match(/<script id=["']datos["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) throw new Error('No se ha encontrado el bloque JSON id="datos".');

    const questions = JSON.parse(match[1]) as UniversalQuestion[];
    const map = new Map<string, ImportGroup>();

    for (const q of questions) {
      const key = `${q.m}|||${q.a}`;
      if (!map.has(key)) {
        map.set(key, { municipality: q.m, year: q.a, questions: [] });
      }
      map.get(key)!.questions.push(q);
    }

    return [...map.values()].sort(
      (a, b) => b.year - a.year || a.municipality.localeCompare(b.municipality)
    );
  }

  async importOfficialGroup(group: ImportGroup, limit: number): Promise<string> {
    const selected = group.questions.slice(0, Math.max(1, limit));
    const sourceKey = `${group.municipality}-${group.year}-universal-v01`;

    const { data: existing } = await this.db.client
      .from('official_exams')
      .select('id')
      .eq('source_key', sourceKey)
      .maybeSingle();

    if (existing?.id) {
      throw new Error('Este municipio/año ya ha sido importado con esta clave.');
    }

    const { data: exam, error: examError } = await this.db.client
      .from('official_exams')
      .insert({
        name: `${group.municipality} ${group.year}`,
        municipality: group.municipality,
        year: group.year,
        source_key: sourceKey,
        active: true
      })
      .select('id')
      .single();

    if (examError) throw examError;

    try {
      for (let i = 0; i < selected.length; i++) {
        const q = selected[i];

        const { data: question, error: qError } = await this.db.client
          .from('questions')
          .insert({
            statement: q.e.trim(),
            official: true,
            source_reference: `${group.municipality} ${group.year} · P${q.n}`
          })
          .select('id')
          .single();

        if (qError) throw qError;

        const correctPosition = this.findCorrectPosition(q);
        const options = q.o.slice(0, 4).map((text, index) => ({
          question_id: question.id,
          text: this.stripOptionPrefix(text),
          position: index + 1,
          is_correct: index + 1 === correctPosition
        }));

        const { error: optError } = await this.db.client
          .from('question_options')
          .insert(options);

        if (optError) throw optError;

        const { error: mapError } = await this.db.client
          .from('official_exam_questions')
          .insert({
            exam_id: exam.id,
            question_id: question.id,
            question_number: q.n,
            position: i + 1
          });

        if (mapError) throw mapError;
      }

      return exam.id;
    } catch (error) {
      await this.db.client.from('official_exams').delete().eq('id', exam.id);
      throw error;
    }
  }



  parseTopicCsv(csvText: string) {
    const rows = this.parseCsv(csvText);
    if (rows.length < 2) throw new Error('El CSV no contiene preguntas.');

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    const required = [
      'topic_number',
      'question_number',
      'position',
      'statement',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'correct_option'
    ];

    const missing = required.filter(h => idx(h) < 0);
    if (missing.length) {
      throw new Error(`Faltan columnas obligatorias para temas: ${missing.join(', ')}`);
    }

    const grouped = new Map<number, any>();

    for (const row of rows.slice(1)) {
      if (!row.some(c => c.trim())) continue;

      const topicNumber = Number(row[idx('topic_number')]?.trim());
      if (!Number.isInteger(topicNumber) || topicNumber <= 0) continue;

      const topicName =
        idx('topic_name') >= 0 && row[idx('topic_name')]?.trim()
          ? row[idx('topic_name')].trim()
          : `Tema ${topicNumber}`;

      if (!grouped.has(topicNumber)) {
        grouped.set(topicNumber, {
          topic_number: topicNumber,
          topic_name: topicName,
          questions: []
        });
      }

      grouped.get(topicNumber).questions.push({
        question_number: row[idx('question_number')]?.trim() || '',
        position: Number(row[idx('position')]?.trim() || 0),
        statement: row[idx('statement')]?.trim() || '',
        option_a: row[idx('option_a')]?.trim() || '',
        option_b: row[idx('option_b')]?.trim() || '',
        option_c: row[idx('option_c')]?.trim() || '',
        option_d: row[idx('option_d')]?.trim() || '',
        correct_option: (row[idx('correct_option')]?.trim() || '').toUpperCase(),
        source_name:
          idx('source_name') >= 0
            ? row[idx('source_name')]?.trim() || `Tema ${topicNumber}`
            : `Tema ${topicNumber}`
      });
    }

    const topics = [...grouped.values()].sort(
      (a, b) => a.topic_number - b.topic_number
    );

    for (const topic of topics) {
      topic.questions.sort((a: any, b: any) => a.position - b.position);
    }

    return topics;
  }

  async importTopicCsvGroups(groups: any[]) {
    let importedTopics = 0;
    let importedQuestions = 0;
    let skippedQuestions = 0;

    for (const group of groups) {
      // Importante: se resuelve el topic_id por número.
      // Si el tema ya existe, NO cambiamos su nombre configurado en la plataforma.
      let { data: topic, error: topicError } = await this.db.client
        .from('topics')
        .select('id,number,name')
        .eq('number', group.topic_number)
        .maybeSingle();

      if (topicError) throw topicError;

      if (!topic) {
        const { data: created, error: createError } = await this.db.client
          .from('topics')
          .insert({
            number: group.topic_number,
            name: group.topic_name || `Tema ${group.topic_number}`,
            active: true
          })
          .select('id,number,name')
          .single();

        if (createError) throw createError;
        topic = created;
        importedTopics++;
      }

      for (const q of group.questions) {
        if (!q.statement) continue;

        // Evita duplicar la misma pregunta dentro del mismo tema.
        const { data: existing, error: existingError } = await this.db.client
          .from('questions')
          .select('id')
          .eq('topic_id', topic.id)
          .eq('statement', q.statement)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          skippedQuestions++;
          continue;
        }

        const { data: question, error: qError } = await this.db.client
          .from('questions')
          .insert({
            statement: q.statement,
            topic_id: topic.id,
            official: true,
            source_reference: `${q.source_name} · P${q.question_number}`
          })
          .select('id')
          .single();

        if (qError) throw qError;

        const letters = ['A', 'B', 'C', 'D'];
        if (!letters.includes(q.correct_option)) {
          await this.db.client.from('questions').delete().eq('id', question.id);
          throw new Error(
            `Respuesta correcta inválida en Tema ${group.topic_number}, pregunta ${q.question_number}.`
          );
        }

        const optionValues = [
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d
        ];

        const options = optionValues.map((text: string, index: number) => ({
          question_id: question.id,
          text,
          position: index + 1,
          is_correct: letters[index] === q.correct_option
        }));

        const { error: optionError } = await this.db.client
          .from('question_options')
          .insert(options);

        if (optionError) {
          await this.db.client.from('questions').delete().eq('id', question.id);
          throw optionError;
        }

        importedQuestions++;
      }
    }

    return {
      importedTopics,
      importedQuestions,
      skippedQuestions
    };
  }

  parseOfficialCsv(csvText: string) {
    const rows = this.parseCsv(csvText);
    if (rows.length < 2) throw new Error('El CSV no contiene preguntas.');

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    const required = [
      'exam_name',
      'municipality',
      'year',
      'question_number',
      'position',
      'statement',
      'option_a',
      'option_b',
      'option_c',
      'option_d',
      'correct_option'
    ];

    const missing = required.filter(h => idx(h) < 0);
    if (missing.length) {
      throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}`);
    }

    const grouped = new Map<string, any>();

    for (const row of rows.slice(1)) {
      if (!row.some(c => c.trim())) continue;

      const examName = row[idx('exam_name')]?.trim();
      const municipality = row[idx('municipality')]?.trim();
      const year = Number(row[idx('year')]?.trim());

      if (!examName || !municipality || !year) continue;

      const key = `${examName}|||${municipality}|||${year}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          exam_name: examName,
          municipality,
          year,
          questions: []
        });
      }

      grouped.get(key).questions.push({
        question_number: row[idx('question_number')]?.trim() || '',
        position: Number(row[idx('position')]?.trim() || 0),
        statement: row[idx('statement')]?.trim() || '',
        option_a: row[idx('option_a')]?.trim() || '',
        option_b: row[idx('option_b')]?.trim() || '',
        option_c: row[idx('option_c')]?.trim() || '',
        option_d: row[idx('option_d')]?.trim() || '',
        correct_option: (row[idx('correct_option')]?.trim() || '').toUpperCase(),
        correct_text: idx('correct_text') >= 0 ? row[idx('correct_text')]?.trim() || '' : '',
        source_id: idx('source_id') >= 0 ? row[idx('source_id')]?.trim() || '' : ''
      });
    }

    const exams = [...grouped.values()];

    for (const exam of exams) {
      exam.questions.sort((a: any, b: any) => a.position - b.position);
    }

    return exams;
  }

  async importOfficialCsvExams(exams: any[]) {
    let importedExams = 0;
    let importedQuestions = 0;
    const skipped: string[] = [];

    for (const examData of exams) {
      const sourceKey = `csv-${examData.municipality}-${examData.year}-${this.slug(examData.exam_name)}`;

      const { data: existing, error: existingError } = await this.db.client
        .from('official_exams')
        .select('id')
        .eq('source_key', sourceKey)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        skipped.push(examData.exam_name);
        continue;
      }

      const { data: exam, error: examError } = await this.db.client
        .from('official_exams')
        .insert({
          name: examData.exam_name,
          municipality: examData.municipality,
          year: examData.year,
          source_key: sourceKey,
          active: true
        })
        .select('id')
        .single();

      if (examError) throw examError;

      try {
        for (let i = 0; i < examData.questions.length; i++) {
          const q = examData.questions[i];

          if (!q.statement) continue;

          const { data: question, error: qError } = await this.db.client
            .from('questions')
            .insert({
              statement: q.statement,
              official: true,
              source_reference: `${examData.exam_name} · P${q.question_number || (i + 1)}`
            })
            .select('id')
            .single();

          if (qError) throw qError;

          const letters = ['A', 'B', 'C', 'D'];
          const optionValues = [q.option_a, q.option_b, q.option_c, q.option_d];

          const options = optionValues.map((text: string, index: number) => ({
            question_id: question.id,
            text,
            position: index + 1,
            is_correct: letters[index] === q.correct_option
          }));

          if (!letters.includes(q.correct_option)) {
            throw new Error(
              `Respuesta correcta inválida en ${examData.exam_name}, pregunta ${q.question_number || i + 1}.`
            );
          }

          const { error: optionError } = await this.db.client
            .from('question_options')
            .insert(options);

          if (optionError) throw optionError;

          const { error: relationError } = await this.db.client
            .from('official_exam_questions')
            .insert({
              exam_id: exam.id,
              question_id: question.id,
              question_number: q.question_number || String(i + 1),
              position: q.position || i + 1
            });

          if (relationError) throw relationError;

          importedQuestions++;
        }

        importedExams++;
      } catch (error) {
        await this.db.client.from('official_exams').delete().eq('id', exam.id);
        throw error;
      }
    }

    return {
      importedExams,
      importedQuestions,
      skipped
    };
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && quoted && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = !quoted;
      } else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && next === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }

    row.push(cell);
    rows.push(row);
    return rows;
  }

  private slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private findCorrectPosition(q: UniversalQuestion): number {
    const answer = this.normalize(q.c);
    const options = q.o.map(o => this.normalize(this.stripOptionPrefix(o)));

    const exact = options.findIndex(o => o === answer);
    if (exact >= 0) return exact + 1;

    const contained = options.findIndex(o => o.includes(answer) || answer.includes(o));
    if (contained >= 0) return contained + 1;

    throw new Error(`No se pudo detectar la opción correcta en la pregunta ${q.n}.`);
  }

  private stripOptionPrefix(text: string): string {
    return text.replace(/^\s*[a-dA-D][\)\.\-]\s*/, '').trim();
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
