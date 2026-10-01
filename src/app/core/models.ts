export type UserRole = 'STUDENT' | 'ADMIN';
export type TestMode = 'EXAM' | 'PRACTICE';
export type QuestionOfficialFilter = 'all' | 'official' | 'unofficial';
export type QuestionIssueStatus = 'OPEN' | 'RESOLVED';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name_1: string | null;
  last_name_2: string | null;
  role: UserRole;
  access_enabled: boolean;
}

export interface Topic {
  id: string;
  number: number | null;
  name: string;
  active: boolean;
  question_count?: number;
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

export interface AdminTopicQuestionStats extends Topic {
  question_count: number;
}

export interface AdminTopicQuestionUpdate {
  statement: string;
  explanation: string | null;
  source_reference: string | null;
  options: {
    id: string;
    text: string;
    position: number;
    is_correct: boolean;
  }[];
}

export interface QuestionIssue {
  id: string;
  question_id: string;
  user_id: string;
  message: string;
  status: QuestionIssueStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  questions?: Question | null;
  profiles?: Pick<Profile, 'id' | 'email' | 'full_name' | 'first_name' | 'last_name_1' | 'last_name_2'> | null;
  resolver?: Pick<Profile, 'id' | 'email' | 'full_name' | 'first_name' | 'last_name_1' | 'last_name_2'> | null;
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


export interface TopicResource {
  id: string;
  topic_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface TopicProgress {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  completion: number;
  failedQuestionIds: string[];
  attempts: any[];
}
