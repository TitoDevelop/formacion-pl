export type UserRole = 'STUDENT' | 'ADMIN';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  text: string;
  position: number;
  is_correct: boolean;
}

export interface Question {
  id: string;
  statement: string;
  explanation: string | null;
  topic_id: string | null;
  official: boolean;
  source_reference: string | null;
  question_options?: QuestionOption[];
}

export interface OfficialExam {
  id: string;
  name: string;
  municipality: string;
  year: number;
  call_name: string | null;
  source_key: string | null;
  active: boolean;
}

export interface ExamQuestionRow {
  exam_id: string;
  question_id: string;
  question_number: string | null;
  position: number;
  questions: Question;
}

export interface UniversalQuestion {
  id: number;
  m: string;
  a: number;
  n: string;
  e: string;
  o: string[];
  c: string;
}

export interface ImportGroup {
  municipality: string;
  year: number;
  questions: UniversalQuestion[];
}
