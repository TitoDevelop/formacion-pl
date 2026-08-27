import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { Question, QuestionOption, TestMode } from '../../core/models';

type PlayerSource = 'CUSTOM' | 'REVIEW';

@Component({
  standalone: true,
  template: `
    @if (loading()) {
      <div class="panel empty-state">Preparando test…</div>
    } @else if (error()) {
      <div class="panel empty-state"><h3>No se pudo crear el test</h3><p>{{ error() }}</p></div>
    } @else if (!questions().length) {
      <div class="panel empty-state"><h3>No hay preguntas disponibles</h3><p>Revisa los temas elegidos o marca preguntas para repasar.</p></div>
    } @else {
      <div class="exam-topline">
        <div>
          <span class="eyebrow">{{ mode() === 'PRACTICE' ? 'MODO PRÁCTICA' : 'MODO EXAMEN' }}</span>
          <h1>{{ title() }}</h1>
        </div>
        <div class="progress-text">{{ currentIndex()+1 }} / {{ questions().length }}</div>
      </div>

      <div class="progress"><div [style.width.%]="progress()"></div></div>

      @if (current(); as q) {
        <article class="question-card">
          <div class="question-toolbar">
            <span class="question-meta">Pregunta {{ currentIndex()+1 }}</span>
            <button
              class="review-btn"
              [class.marked]="marked().has(q.id)"
              (click)="toggleMarked(q.id)">
              {{ marked().has(q.id) ? '★ Marcada para repasar' : '☆ Marcar para repasar' }}
            </button>
          </div>

          <h2>{{ q.statement }}</h2>

          <div class="options">
            @for (opt of sortedOptions(q); track opt.id) {
              <button
                class="option"
                [class.selected]="selected()[q.id] === opt.id"
                [class.correct]="mode()==='PRACTICE' && answered().has(q.id) && opt.is_correct"
                [class.incorrect]="mode()==='PRACTICE' && answered().has(q.id) && selected()[q.id] === opt.id && !opt.is_correct"
                [disabled]="mode()==='PRACTICE' && answered().has(q.id)"
                (click)="select(q, opt)">
                <span>{{ letter(opt.position) }}</span>
                <p>{{ opt.text }}</p>
              </button>
            }
          </div>

          @if (mode()==='PRACTICE' && answered().has(q.id)) {
            <div class="practice-feedback" [class.ok]="isCurrentCorrect()">
              <strong>{{ isCurrentCorrect() ? '✓ Correcta' : '✗ Incorrecta' }}</strong>
              @if (!isCurrentCorrect()) {
                <span>Respuesta correcta: {{ correctOptionText(q) }}</span>
              }
              @if (q.explanation) {
                <p>{{ q.explanation }}</p>
              }
            </div>
          }
        </article>

        <div class="exam-nav">
          <button class="btn" (click)="prev()" [disabled]="currentIndex()===0">← Anterior</button>

          @if (currentIndex() < questions().length - 1) {
            <button
              class="btn primary"
              (click)="next()"
              [disabled]="mode()==='PRACTICE' && !answered().has(q.id)">
              Siguiente →
            </button>
          } @else {
            <button
              class="btn success"
              (click)="finish()"
              [disabled]="submitting() || (mode()==='PRACTICE' && !answered().has(q.id))">
              {{ submitting() ? 'Guardando…' : 'Finalizar test' }}
            </button>
          }
        </div>
      }
    }
  `
})
export class TestPlayerComponent implements OnInit {
  questions = signal<Question[]>([]);
  currentIndex = signal(0);
  selected = signal<Record<string, string>>({});
  answered = signal<Set<string>>(new Set());
  marked = signal<Set<string>>(new Set());
  loading = signal(true);
  submitting = signal(false);
  error = signal('');
  mode = signal<TestMode>('EXAM');
  title = signal('Test personalizado');
  source = signal<PlayerSource>('CUSTOM');
  topicIds: string[] = [];

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
    try {
      const source = (this.route.snapshot.data['source'] ?? 'CUSTOM') as PlayerSource;
      const mode = (this.route.snapshot.queryParamMap.get('mode') ?? 'EXAM') as TestMode;
      const count = Math.max(1, Math.min(200, Number(this.route.snapshot.queryParamMap.get('count') ?? 20)));

      this.source.set(source);
      this.mode.set(mode === 'PRACTICE' ? 'PRACTICE' : 'EXAM');

      let questions: Question[] = [];

      if (source === 'REVIEW') {
        this.title.set('Repaso de preguntas marcadas');
        questions = await this.data.getReviewQuestions(count);
      } else {
        this.topicIds = (this.route.snapshot.queryParamMap.get('topics') ?? '')
          .split(',')
          .filter(Boolean);

        this.title.set('Test personalizado');
        questions = await this.data.getCustomQuestions(this.topicIds, count);
      }

      this.questions.set(questions);
      this.marked.set(await this.data.reviewQuestionIds(questions.map(q => q.id)));
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo preparar el test.');
    } finally {
      this.loading.set(false);
    }
  }

  sortedOptions(q: Question): QuestionOption[] {
    return [...(q.question_options ?? [])].sort((a,b) => a.position-b.position);
  }

  letter(pos: number) {
    return ['A','B','C','D'][pos-1] ?? '?';
  }

  select(q: Question, option: QuestionOption) {
    if (this.mode() === 'PRACTICE' && this.answered().has(q.id)) return;

    this.selected.update(s => ({ ...s, [q.id]: option.id }));

    if (this.mode() === 'PRACTICE') {
      this.answered.update(set => {
        const next = new Set(set);
        next.add(q.id);
        return next;
      });
    }
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

  correctOptionText(q: Question) {
    return q.question_options?.find(o => o.is_correct)?.text ?? 'No disponible';
  }

  isCurrentCorrect() {
    const q = this.current();
    if (!q) return false;
    const selectedId = this.selected()[q.id];
    return q.question_options?.some(o => o.id === selectedId && o.is_correct) ?? false;
  }

  next() {
    if (this.currentIndex() < this.questions().length - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  prev() {
    if (this.currentIndex() > 0) this.currentIndex.update(i => i - 1);
  }

  async finish() {
    if (this.mode() === 'EXAM' && !confirm('¿Finalizar el test y ver el resultado?')) return;

    this.submitting.set(true);

    try {
      const payload = this.questions().map(q => {
        const optionId = this.selected()[q.id] ?? null;
        const correctOption = q.question_options?.find(o => o.is_correct);

        return {
          questionId: q.id,
          selectedOptionId: optionId,
          correct: !!optionId && optionId === correctOption?.id
        };
      });

      const attemptId = await this.data.finishAttempt(
        null,
        this.source() === 'REVIEW' ? 'MISTAKES' : 'CUSTOM',
        this.mode(),
        this.title(),
        this.source() === 'CUSTOM' ? this.topicIds : null,
        payload
      );

      await this.router.navigate(['/app/resultado', attemptId]);
    } finally {
      this.submitting.set(false);
    }
  }
}
