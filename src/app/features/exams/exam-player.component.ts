import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { ExamQuestionRow, OfficialExam, QuestionOption, TestMode } from '../../core/models';
import { TestTimer, formatDuration } from '../../core/test-timer';

@Component({
  standalone: true,
  template: `
    @if (loading()) {
      <div class="panel empty-state">Preparando examen...</div>
    } @else if (exam()) {
      <div class="exam-topline">
        <div>
          <span class="eyebrow">{{ mode() === 'PRACTICE' ? 'OFICIAL - MODO PRÁCTICO' : 'EXAMEN OFICIAL' }}</span>
          <h1>{{ exam()!.municipality }} · {{ exam()!.year }}</h1>
        </div>
        <div class="exam-progress-actions">
          <div class="test-timer" aria-label="Tiempo transcurrido">⏱ {{ formatTime(timer.elapsedSeconds()) }}</div>
          <div class="progress-text">{{ currentIndex()+1 }} / {{ questions().length }}</div>
          <button class="btn test-exit-button" type="button" (click)="showExitDialog.set(true)">Salir</button>
        </div>
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
                [class.correct]="mode()==='PRACTICE' && answered().has(row.question_id) && opt.is_correct"
                [class.incorrect]="mode()==='PRACTICE' && answered().has(row.question_id) && selected()[row.question_id] === opt.id && !opt.is_correct"
                [disabled]="mode()==='PRACTICE' && answered().has(row.question_id)"
                (click)="select(row, opt)">
                <span>{{ letter(opt.position) }}</span>
                <p>{{ opt.text }}</p>
              </button>
            }
          </div>

          @if (mode()==='PRACTICE' && answered().has(row.question_id)) {
            <div class="practice-feedback" [class.ok]="isCorrect(row)">
              <strong>{{ isCorrect(row) ? '✓ Correcta' : '✕ Incorrecta' }}</strong>
              @if (!isCorrect(row)) {
                <span>Respuesta correcta: {{ correctText(row) }}</span>
              }
              @if (row.questions.explanation) {
                <p>{{ row.questions.explanation }}</p>
              }
            </div>
          }
        </article>

        <div class="exam-nav">
          <button class="btn" (click)="prev()" [disabled]="currentIndex()===0">← Anterior</button>
          <button class="btn danger test-exit-button" type="button" (click)="showExitDialog.set(true)">Salir y eliminar</button>

          @if (currentIndex() < questions().length - 1) {
            <button
              class="btn primary"
              (click)="next()"
              [disabled]="mode()==='PRACTICE' && !answered().has(row.question_id)">
              Siguiente →
            </button>
          } @else {
            <button
              class="btn success"
              (click)="finish()"
              [disabled]="submitting() || (mode()==='PRACTICE' && !answered().has(row.question_id))">
              {{ submitting() ? 'Guardando...' : 'Finalizar' }}
            </button>
          }
        </div>
      }

      @if (showExitDialog()) {
        <div class="mode-picker-backdrop" (click)="showExitDialog.set(false)">
          <section class="panel mode-picker exit-test-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-official-title" (click)="$event.stopPropagation()">
            <button class="mode-picker-close" type="button" aria-label="Cerrar" (click)="showExitDialog.set(false)">×</button>
            <span class="eyebrow">EXAMEN EN CURSO</span>
            <h2 id="exit-official-title">¿Salir del examen?</h2>
            <p>Se eliminará este intento y no se guardará ninguna respuesta ni puntuación.</p>
            <div class="exit-test-actions">
              <button class="btn danger" type="button" (click)="exitAndDelete()">Salir y eliminar</button>
              <button class="btn primary" type="button" (click)="showExitDialog.set(false)">Continuar examen</button>
            </div>
          </section>
        </div>
      }
    }
  `
})
export class ExamPlayerComponent implements OnInit, OnDestroy {
  readonly timer = new TestTimer();
  exam = signal<OfficialExam | null>(null);
  questions = signal<ExamQuestionRow[]>([]);
  currentIndex = signal(0);
  selected = signal<Record<string, string>>({});
  answered = signal<Set<string>>(new Set());
  marked = signal<Set<string>>(new Set());
  mode = signal<TestMode>('EXAM');
  loading = signal(true);
  submitting = signal(false);
  showExitDialog = signal(false);

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
    this.mode.set(this.route.snapshot.queryParamMap.get('mode') === 'PRACTICE' ? 'PRACTICE' : 'EXAM');

    try {
      const [exam, questions] = await Promise.all([
        this.data.getExam(id),
        this.data.getExamQuestions(id)
      ]);
      this.exam.set(exam);
      this.questions.set(questions);
      this.marked.set(await this.data.reviewQuestionIds(questions.map(q => q.question_id)));
      if (questions.length) this.timer.start(this.router.url);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.timer.stop();
  }

  formatTime(seconds: number) {
    return formatDuration(seconds);
  }

  sortedOptions(row: ExamQuestionRow): QuestionOption[] {
    return [...(row.questions.question_options ?? [])].sort((a, b) => a.position - b.position);
  }

  letter(pos: number) {
    return ['A', 'B', 'C', 'D'][pos - 1] ?? '?';
  }

  select(row: ExamQuestionRow, opt: QuestionOption) {
    if (this.mode() === 'PRACTICE' && this.answered().has(row.question_id)) return;

    this.selected.update(s => ({ ...s, [row.question_id]: opt.id }));

    if (this.mode() === 'PRACTICE') {
      this.answered.update(set => {
        const next = new Set(set);
        next.add(row.question_id);
        return next;
      });
    }
  }

  isCorrect(row: ExamQuestionRow) {
    const id = this.selected()[row.question_id];
    return row.questions.question_options?.some(o => o.id === id && o.is_correct) ?? false;
  }

  correctText(row: ExamQuestionRow) {
    return row.questions.question_options?.find(o => o.is_correct)?.text ?? 'No disponible';
  }

  async toggleMarked(id: string) {
    const nextValue = !this.marked().has(id);
    await this.data.setReview(id, nextValue);
    this.marked.update(set => {
      const next = new Set(set);
      nextValue ? next.add(id) : next.delete(id);
      return next;
    });
  }

  next() {
    if (this.currentIndex() < this.questions().length - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  prev() {
    if (this.currentIndex() > 0) this.currentIndex.update(i => i - 1);
  }

  async exitAndDelete() {
    const exam = this.exam();
    this.timer.clear();
    this.showExitDialog.set(false);
    await this.router.navigate(exam ? ['/app/oficiales', exam.id] : ['/app/tests']);
  }

  async finish() {
    if (this.mode() === 'EXAM' && !confirm('¿Finalizar el examen y ver la corrección?')) return;

    this.submitting.set(true);

    try {
      const payload = this.questions().map(row => {
        const id = this.selected()[row.question_id] ?? null;
        const correctOption = row.questions.question_options?.find(o => o.is_correct);

        return {
          questionId: row.question_id,
          selectedOptionId: id,
          correct: !!id && id === correctOption?.id
        };
      });

      const exam = this.exam()!;
      const timing = this.timer.snapshot();
      const attemptId = await this.data.finishAttempt(
        exam.id,
        'OFFICIAL',
        this.mode(),
        exam.name,
        null,
        payload,
        timing
      );

      this.timer.clear();
      await this.router.navigate(['/app/resultado', attemptId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
