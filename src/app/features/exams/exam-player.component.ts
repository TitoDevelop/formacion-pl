import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { ExamQuestionRow, OfficialExam, QuestionOption } from '../../core/models';

@Component({
  standalone: true,
  template: `
    @if (loading()) {
      <div class="panel empty-state">Preparando examen…</div>
    } @else if (exam()) {
      <div class="exam-topline">
        <div>
          <span class="eyebrow">EXAMEN OFICIAL</span>
          <h1>{{ exam()!.municipality }} · {{ exam()!.year }}</h1>
        </div>
        <div class="progress-text">{{ currentIndex()+1 }} / {{ questions().length }}</div>
      </div>

      <div class="progress"><div [style.width.%]="progress()"></div></div>

      @if (current(); as row) {
        <article class="question-card">
          <div class="question-toolbar">
            <span class="question-meta">Pregunta {{ row.question_number || currentIndex()+1 }}</span>
            <button
              class="review-btn"
              [class.marked]="marked().has(row.question_id)"
              (click)="toggleMarked(row.question_id)">
              {{ marked().has(row.question_id) ? '★ Marcada para repasar' : '☆ Marcar para repasar' }}
            </button>
          </div>

          <h2>{{ row.questions.statement }}</h2>

          <div class="options">
            @for (opt of sortedOptions(row); track opt.id) {
              <button
                class="option"
                [class.selected]="selected()[row.question_id] === opt.id"
                (click)="select(row.question_id, opt.id)">
                <span>{{ letter(opt.position) }}</span>
                <p>{{ opt.text }}</p>
              </button>
            }
          </div>
        </article>

        <div class="exam-nav">
          <button class="btn" (click)="prev()" [disabled]="currentIndex()===0">← Anterior</button>

          @if (currentIndex() < questions().length - 1) {
            <button class="btn primary" (click)="next()">Siguiente →</button>
          } @else {
            <button class="btn success" (click)="finish()" [disabled]="submitting()">
              {{ submitting() ? 'Corrigiendo…' : 'Finalizar y corregir' }}
            </button>
          }
        </div>
      }
    }
  `
})
export class ExamPlayerComponent implements OnInit {
  exam = signal<OfficialExam | null>(null);
  questions = signal<ExamQuestionRow[]>([]);
  currentIndex = signal(0);
  selected = signal<Record<string, string>>({});
  marked = signal<Set<string>>(new Set());
  loading = signal(true);
  submitting = signal(false);

  progress = computed(() =>
    this.questions().length
      ? ((this.currentIndex()+1) / this.questions().length) * 100
      : 0
  );

  current = computed(() => this.questions()[this.currentIndex()] ?? null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private data: DataService
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    try {
      const [exam, questions] = await Promise.all([
        this.data.getExam(id),
        this.data.getExamQuestions(id)
      ]);

      this.exam.set(exam);
      this.questions.set(questions);
      this.marked.set(await this.data.reviewQuestionIds(questions.map(q => q.question_id)));
    } finally {
      this.loading.set(false);
    }
  }

  sortedOptions(row: ExamQuestionRow): QuestionOption[] {
    return [...(row.questions.question_options ?? [])]
      .sort((a,b) => a.position-b.position);
  }

  letter(pos: number) {
    return ['A','B','C','D'][pos-1] ?? '?';
  }

  select(questionId: string, optionId: string) {
    this.selected.update(s => ({...s, [questionId]: optionId}));
  }

  async toggleMarked(questionId: string) {
    const nextValue = !this.marked().has(questionId);
    await this.data.setReview(questionId, nextValue);

    this.marked.update(set => {
      const next = new Set(set);
      nextValue ? next.add(questionId) : next.delete(questionId);
      return next;
    });
  }

  next() {
    if (this.currentIndex() < this.questions().length-1) {
      this.currentIndex.update(i => i+1);
    }
  }

  prev() {
    if (this.currentIndex() > 0) this.currentIndex.update(i => i-1);
  }

  async finish() {
    if (!confirm('¿Finalizar el examen y ver la corrección?')) return;

    this.submitting.set(true);

    try {
      const payload = this.questions().map(row => {
        const optionId = this.selected()[row.question_id] ?? null;
        const correctOption = row.questions.question_options?.find(o => o.is_correct);

        return {
          questionId: row.question_id,
          selectedOptionId: optionId,
          correct: !!optionId && optionId === correctOption?.id
        };
      });

      const exam = this.exam()!;
      const attemptId = await this.data.finishAttempt(
        exam.id,
        'OFFICIAL',
        'EXAM',
        exam.name,
        null,
        payload
      );

      await this.router.navigate(['/app/resultado', attemptId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
