import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">TU PREPARACIÓN</span>
        <h1>Hola, {{ firstName() }}</h1>
        <p>Resumen de los últimos 7 días.</p>
      </div>
    </header>

    <section class="metric-grid">
      <article class="metric"><span>Preguntas realizadas</span><strong>{{ totalQuestions() }}</strong><small>Últimos 7 días</small></article>
      <article class="metric"><span>Acierto medio</span><strong>{{ accuracy() }}%</strong><small>Sobre preguntas respondidas</small></article>
      <article class="metric"><span>Tests completados</span><strong>{{ attempts().length }}</strong><small>Últimos 7 días</small></article>
      <article class="metric accent"><span>Nota media</span><strong>{{ avgScore() }}</strong><small>Sobre 10</small></article>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>Actividad reciente</h2><p>Tus últimos simulacros.</p></div></div>
      @if (loading()) {
        <div class="empty-state">Cargando actividad…</div>
      } @else if (!attempts().length) {
        <div class="empty-state">Aún no has terminado ningún examen. Empieza por un oficial.</div>
      } @else {
        <div class="attempt-list">
          @for (a of attempts(); track a.id) {
            <div class="attempt-row">
              <div><strong>{{ a.total_questions }} preguntas</strong><span>{{ a.finished_at | date:'dd/MM/yyyy HH:mm' }}</span></div>
              <div class="score-pill">{{ a.score }}/10</div>
            </div>
          }
        </div>
      }
    </section>
  `,
  imports: [DatePipe]
})
export class DashboardComponent implements OnInit {
  attempts = signal<any[]>([]);
  loading = signal(true);
  firstName = computed(() => (this.auth.profile()?.full_name || 'opositor').split(' ')[0]);
  totalQuestions = computed(() => this.attempts().reduce((s, a) => s + (a.total_questions || 0), 0));
  totalCorrect = computed(() => this.attempts().reduce((s, a) => s + (a.correct_answers || 0), 0));
  accuracy = computed(() => this.totalQuestions() ? Math.round(this.totalCorrect() / this.totalQuestions() * 100) : 0);
  avgScore = computed(() => this.attempts().length
    ? (this.attempts().reduce((s, a) => s + Number(a.score || 0), 0) / this.attempts().length).toFixed(1)
    : '0.0');

  constructor(public auth: AuthService, private data: DataService) {}
  async ngOnInit() {
    try { this.attempts.set(await this.data.weeklyStats()); }
    finally { this.loading.set(false); }
  }
}
