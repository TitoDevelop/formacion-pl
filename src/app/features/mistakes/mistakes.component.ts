import { Component, OnInit, signal } from '@angular/core';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  template: `
    <header class="page-title">
      <div><span class="eyebrow">REPASO</span><h1>Preguntas falladas</h1><p>Últimas preguntas que has contestado incorrectamente.</p></div>
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
            @if (q.source_reference) { <small>{{ q.source_reference }}</small> }
          </article>
        }
      </div>
    }
  `
})
export class MistakesComponent implements OnInit {
  questions = signal<any[]>([]);
  loading = signal(true);
  constructor(private data: DataService) {}
  async ngOnInit() {
    try { this.questions.set(await this.data.failedQuestions()); }
    finally { this.loading.set(false); }
  }
  correctText(q: any) {
    return q.question_options?.find((o: any) => o.is_correct)?.text ?? 'No disponible';
  }
}
