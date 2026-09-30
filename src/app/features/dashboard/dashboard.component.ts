import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { Topic } from '../../core/models';
import { formatDuration } from '../../core/test-timer';

@Component({
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">TU PREPARACIÓN</span>
        <h1>Hola, {{ firstName() }}</h1>
        <p>Resumen de los últimos 7 días.</p>
      </div>
      <a routerLink="/app/crear-test" class="btn primary">+ Crear test</a>
    </header>

    <section class="metric-grid">
      <article class="metric"><span>Preguntas realizadas</span><strong>{{ totalQuestions() }}</strong><small>Temas y personalizados</small></article>
      <article class="metric"><span>Acierto medio</span><strong>{{ accuracy() }}%</strong><small>Sobre preguntas respondidas</small></article>
      <article class="metric"><span>Tests completados</span><strong>{{ scoringAttempts().length }}</strong><small>Temas y personalizados</small></article>
      <article class="metric accent"><span>Nota media</span><strong>{{ avgScore() }}</strong><small>Sobre 10</small></article>
    </section>

    <section class="quick-actions">
      <a routerLink="/app/crear-test" class="quick-card"><span>＋</span><div><strong>Test personalizado</strong><small>Temas, cantidad y modo</small></div></a>
      <a routerLink="/app/tests" class="quick-card"><span>▣</span><div><strong>Ver tests</strong><small>Temas y oficiales</small></div></a>
      <a routerLink="/app/repasar" class="quick-card"><span>★</span><div><strong>Repasar</strong><small>Preguntas que has marcado</small></div></a>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><h2>Actividad reciente</h2><p>Tus últimos tests.</p></div>
      </div>

      @if (loading()) {
        <div class="empty-state">Cargando actividad…</div>
      } @else if (!attempts().length) {
        <div class="empty-state">Aún no has terminado ningún test.</div>
      } @else {
        <div class="attempt-list">
          @for (a of attempts(); track a.id) {
            <div class="attempt-row">
              <div>
                <strong>{{ attemptTitle(a) }}</strong>
                <span>{{ a.finished_at | date:'dd/MM/yyyy HH:mm' }} · {{ attemptLabel(a) }} · {{ a.mode === 'PRACTICE' ? 'Práctico' : 'Examen' }}</span>
                @if (a.duration_seconds != null) { <span class="attempt-duration">⏱ {{ formatTime(a.duration_seconds) }}</span> }
              </div>
              <div class="score-pill">{{ a.score }}/10</div>
            </div>
          }
        </div>
      }
    </section>
  `
})
export class DashboardComponent implements OnInit {
  attempts = signal<any[]>([]);
  topics = signal<Topic[]>([]);
  loading = signal(true);

  firstName = computed(() =>
    (this.auth.profile()?.full_name || 'opositor').split(' ')[0]
  );

  scoringAttempts = computed(() =>
    this.attempts().filter(a => a.attempt_type === 'CUSTOM' || a.attempt_type === 'TOPIC')
  );

  totalQuestions = computed(() =>
    this.scoringAttempts().reduce((s, a) => s + (a.total_questions || 0), 0)
  );

  totalCorrect = computed(() =>
    this.scoringAttempts().reduce((s, a) => s + (a.correct_answers || 0), 0)
  );

  accuracy = computed(() =>
    this.totalQuestions()
      ? Math.round(this.totalCorrect() / this.totalQuestions() * 100)
      : 0
  );

  avgScore = computed(() =>
    this.scoringAttempts().length
      ? (this.scoringAttempts().reduce((s, a) => s + Number(a.score || 0), 0) / this.scoringAttempts().length).toFixed(1)
      : '0.0'
  );

  constructor(
    public auth: AuthService,
    private data: DataService
  ) {}

  async ngOnInit() {
    try {
      const [attempts, topics] = await Promise.all([
        this.data.weeklyStats(),
        this.data.listTopics()
      ]);
      this.attempts.set(attempts);
      this.topics.set(topics);
    } finally {
      this.loading.set(false);
    }
  }

  formatTime(seconds: number) {
    return formatDuration(seconds);
  }

  attemptLabel(a: any) {
    if (a.attempt_type === 'OFFICIAL') return 'Oficial';
    if (a.attempt_type === 'MISTAKES') return 'Repaso';
    return 'Puntuable';
  }

  attemptTitle(a: any) {
    if (a.attempt_type === 'OFFICIAL') {
      const exam = Array.isArray(a.official_exams) ? a.official_exams[0] : a.official_exams;
      if (exam?.municipality) {
        return `Examen oficial de ${exam.municipality}${exam.year ? ` ${exam.year}` : ''}`;
      }
    }

    const title = a.title || '';
    if (!this.isGenericTopicTitle(title)) return title || `${a.total_questions} preguntas`;

    const topicLabel = this.topicLabel(a.topic_ids ?? []);
    if (!topicLabel) return title || `${a.total_questions} preguntas`;

    const topicConnector = topicLabel.startsWith('tema ') ? 'del' : 'de';
    if (title === 'Test personalizado' || /^Test personalizado de \d+ temas$/.test(title)) {
      return `Test personalizado ${topicConnector} ${topicLabel}`;
    }
    if (title === 'Test oficial del tema') return `Test oficial ${topicConnector} ${topicLabel}`;
    if (title === 'Test no oficial del tema') return `Test no oficial ${topicConnector} ${topicLabel}`;
    if (title === 'Test completo del tema') return `Test completo ${topicConnector} ${topicLabel}`;
    return title;
  }

  private isGenericTopicTitle(title: string) {
    return [
      'Test personalizado',
      'Test oficial del tema',
      'Test no oficial del tema',
      'Test completo del tema'
    ].includes(title) || /^Test personalizado de \d+ temas$/.test(title);
  }

  private topicLabel(topicIds: string[]) {
    if (topicIds.length === 1) {
      const topic = this.topics().find(t => t.id === topicIds[0]);
      return topic?.number != null ? `tema ${topic.number}` : '1 tema';
    }

    if (topicIds.length > 1) {
      const topicNumbers = topicIds
        .map(id => this.topics().find(topic => topic.id === id)?.number)
        .filter((number): number is number => number != null)
        .sort((a, b) => a - b);

      return topicNumbers.length
        ? `los temas ${this.formatList(topicNumbers.map(String))}`
        : `${topicIds.length} temas`;
    }

    return '';
  }

  private formatList(values: string[]) {
    if (values.length <= 1) return values[0] ?? '';
    if (values.length === 2) return `${values[0]} y ${values[1]}`;
    return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
  }
}
