import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ExamQuestionRow, ImportGroup, OfficialExam, UniversalQuestion } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private db: SupabaseService, private auth: AuthService) {}

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
      .from('official_exams').select('*').eq('id', examId).single();
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

  async finishAttempt(
    examId: string | null,
    attemptType: 'OFFICIAL' | 'MISTAKES',
    questions: { questionId: string; selectedOptionId: string | null; correct: boolean }[]
  ): Promise<string> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('No hay sesión activa.');

    const correct = questions.filter(q => q.correct).length;
    const blank = questions.filter(q => !q.selectedOptionId).length;
    const wrong = questions.length - correct - blank;
    const score = questions.length ? Number(((correct / questions.length) * 10).toFixed(2)) : 0;

    const { data: attempt, error } = await this.db.client
      .from('test_attempts')
      .insert({
        user_id: userId,
        exam_id: examId,
        attempt_type: attemptType,
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
      .select('id,total_questions,correct_answers,wrong_answers,score,finished_at')
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

    return [...map.values()].sort((a, b) =>
      b.year - a.year || a.municipality.localeCompare(b.municipality)
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
