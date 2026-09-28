import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  template: `
    <header class="page-title">
      <div><span class="eyebrow">REPASO</span><h1>Preguntas falladas</h1><p>Últimas preguntas que has contestado incorrectamente.</p></div>
      @if (questions().length) {
        <div class="page-actions">
          <button class="btn danger-btn" type="button" [disabled]="clearingAll()" (click)="clearAllFailed()">
            {{ clearingAll() ? 'Borrando...' : 'Borrar todas' }}
          </button>
          <button class="btn primary" type="button" [disabled]="clearingAll()" (click)="practiceFailed()">Practicar falladas</button>
        </div>
      }
    </header>

    @if (loading()) {
      <div class="panel empty-state">Buscando tus fallos…</div>
    } @else if (!questions().length) {
      <div class="panel empty-state"><h3>Sin fallos pendientes</h3><p>Cuando falles preguntas aparecerán aquí.</p></div>
    } @else {
      <div class="mistake-list">
        @for (q of questions(); track q.id; let i = $index) {
          <article class="mistake-card">
            <span class="question-meta">Fallo #{{ i+1 }}</span>
            <h3>{{ q.statement }}</h3>
            <div class="correct-answer">
              Correcta:
              <strong>{{ correctText(q) }}</strong>
            </div>
            <div class="mistake-card-footer">
              @if (q.source_reference) { <small>{{ q.source_reference }}</small> }
              <button
                class="mistake-resolve-btn"
                type="button"
                [disabled]="resolving().has(q.id)"
                (click)="resolve(q)">
                <span>✓</span>
                {{ resolving().has(q.id) ? 'Quitando...' : 'Ya la domino' }}
              </button>
            </div>
          </article>
        }
      </div>
    }
  `
})
export class MistakesComponent implements OnInit {
  questions = signal<any[]>([]);
  resolving = signal<Set<string>>(new Set());
  clearingAll = signal(false);
  loading = signal(true);
  constructor(private data: DataService, private router: Router) {}
  async ngOnInit() {
    try { this.questions.set(await this.data.failedQuestions()); }
    finally { this.loading.set(false); }
  }
  correctText(q: any) {
    return q.question_options?.find((o: any) => o.is_correct)?.text ?? 'No disponible';
  }

  async resolve(q: any) {
    if (!confirm('¿Quitar esta pregunta de falladas? Si vuelves a fallarla en un test puntuable, reaparecerá.')) return;
    this.resolving.update(ids => new Set(ids).add(q.id));
    try {
      await this.data.resolveFailedQuestion(q.id);
      this.questions.update(items => items.filter(item => item.id !== q.id));
    } finally {
      this.resolving.update(ids => {
        const next = new Set(ids);
        next.delete(q.id);
        return next;
      });
    }
  }

  async clearAllFailed() {
    const questionIds = this.questions().map(q => q.id);
    if (!questionIds.length) return;
    if (!confirm(`¿Borrar las ${questionIds.length} preguntas falladas? Si vuelves a fallarlas en un test puntuable, reaparecerán.`)) return;

    this.clearingAll.set(true);
    try {
      await this.data.resolveFailedQuestions(questionIds);
      this.questions.set([]);
      this.resolving.set(new Set());
    } finally {
      this.clearingAll.set(false);
    }
  }

  practiceFailed() {
    this.router.navigate(['/app/test/falladas'], {
      queryParams: {
        count: this.questions().length,
        mode: 'PRACTICE'
      }
    });
  }
}
