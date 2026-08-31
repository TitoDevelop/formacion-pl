import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { TestMode, Topic } from '../../core/models';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ENTRENAMIENTO</span>
        <h1>Crear test personalizado</h1>
        <p>Elige temas, número de preguntas y cómo quieres corregir.</p>
      </div>
    </header>

    <div class="builder-layout">
      <section class="panel">
        <h2>1. Selecciona los temas</h2>

        @if (loading()) {
          <div class="empty-state">Cargando temas…</div>
        } @else {
          <div class="topic-selector">
            @for (topic of topics(); track topic.id) {
              <button
                class="topic-choice"
                [class.selected]="selectedTopics().has(topic.id)"
                [class.empty-topic]="topicQuestionCount(topic.id) === 0"
                (click)="toggleTopic(topic)">
                <span class="topic-number">{{ topic.number ?? '—' }}</span>
                <div>
                  <strong>{{ topic.name }}</strong>
                  <small>{{ topicQuestionCountLabel(topic.id) }}</small>
                </div>
                <span class="check">{{ selectedTopics().has(topic.id) ? '✓' : '+' }}</span>
              </button>
            }
          </div>
        }
      </section>

      <aside class="panel builder-config">
        <h2>2. Configura el test</h2>

        <label>Número de preguntas</label>
        <div class="quantity-row">
          @for (n of quantities; track n) {
            <button
              class="quantity"
              [class.selected]="count===n"
              (click)="count=n">
              {{ n }}
            </button>
          }
        </div>

        <label>Modo</label>
        <div class="mode-grid">
          <button class="mode-card" [class.selected]="mode==='EXAM'" (click)="mode='EXAM'">
            <strong>📝 Examen</strong>
            <span>No muestra corrección hasta finalizar.</span>
          </button>

          <button class="mode-card" [class.selected]="mode==='PRACTICE'" (click)="mode='PRACTICE'">
            <strong>⚡ Práctico</strong>
            <span>Corrige cada pregunta al responder.</span>
          </button>
        </div>

        <div class="builder-summary">
          <span>Temas seleccionados</span>
          <strong>{{ selectedTopics().size }}</strong>
          <span>Preguntas disponibles</span>
          <strong>{{ selectedQuestionTotalLabel() }}</strong>
          <span>Preguntas del test</span>
          <strong>{{ count }}</strong>
        </div>

        @if (error()) { <div class="form-error">{{ error() }}</div> }

        <button class="btn primary wide" (click)="start()">COMENZAR TEST</button>
      </aside>
    </div>
  `
})
export class CustomTestComponent implements OnInit {
  topics = signal<Topic[]>([]);
  selectedTopics = signal<Set<string>>(new Set());
  questionCounts = signal<Record<string, number>>({});
  loadingCounts = signal<Set<string>>(new Set());
  loading = signal(true);
  error = signal('');
  count = 20;
  mode: TestMode = 'EXAM';
  quantities = [10, 20, 30, 50, 100];

  constructor(
    private data: DataService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    try {
      this.topics.set(await this.data.listTopics());

      const preselected = this.route.snapshot.queryParamMap.get('topic');
      if (preselected) {
        const topic = this.topics().find(t => t.id === preselected);
        if (topic) {
          this.selectedTopics.set(new Set([topic.id]));
          void this.ensureTopicCount(topic.id);
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  toggleTopic(topic: Topic) {
    this.selectedTopics.update(set => {
      const next = new Set(set);
      next.has(topic.id) ? next.delete(topic.id) : next.add(topic.id);
      return next;
    });

    if (this.selectedTopics().has(topic.id)) {
      void this.ensureTopicCount(topic.id);
    }
  }

  start() {
    this.error.set('');

    if (!this.selectedTopics().size) {
      this.error.set('Selecciona al menos un tema.');
      return;
    }

    const selectedIds = [...this.selectedTopics()];
    const selectedTotal = selectedIds.reduce((sum, id) => sum + (this.questionCounts()[id] ?? 0), 0);

    if (selectedIds.some(id => this.questionCounts()[id] === undefined)) {
      this.error.set('Espera un momento a que se calcule cuantas preguntas hay.');
      return;
    }

    if (!selectedTotal) {
      this.error.set('Los temas seleccionados no tienen preguntas disponibles.');
      return;
    }

    this.router.navigate(['/app/test/personalizado'], {
      queryParams: {
        topics: selectedIds.join(','),
        count: this.count,
        mode: this.mode
      }
    });
  }

  topicQuestionCount(topicId: string): number | undefined {
    return this.questionCounts()[topicId];
  }

  topicQuestionCountLabel(topicId: string) {
    if (this.loadingCounts().has(topicId)) return 'Calculando preguntas...';
    const count = this.questionCounts()[topicId];
    if (count === undefined) return 'Selecciona para ver preguntas';
    return `${count} preguntas disponibles`;
  }

  selectedQuestionTotalLabel() {
    const selectedIds = [...this.selectedTopics()];
    if (!selectedIds.length) return '0';
    if (selectedIds.some(id => this.loadingCounts().has(id) || this.questionCounts()[id] === undefined)) {
      return 'Calculando...';
    }
    return String(selectedIds.reduce((sum, id) => sum + (this.questionCounts()[id] ?? 0), 0));
  }

  private async ensureTopicCount(topicId: string) {
    if (this.questionCounts()[topicId] !== undefined || this.loadingCounts().has(topicId)) return;

    this.loadingCounts.update(set => new Set(set).add(topicId));

    try {
      const count = await this.data.countTopicQuestions([topicId]);
      this.questionCounts.update(counts => ({ ...counts, [topicId]: count }));
    } finally {
      this.loadingCounts.update(set => {
        const next = new Set(set);
        next.delete(topicId);
        return next;
      });
    }
  }
}
