import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { OfficialExam, TestMode } from '../../core/models';

@Component({
  standalone: true,
  template: `
    @if (loading()) {
      <div class="panel empty-state">Cargando examen…</div>
    } @else {
      @if (exam(); as e) {
        <header class="page-title">
          <div>
            <span class="eyebrow">EXAMEN OFICIAL</span>
            <h1>{{ e.municipality }} · {{ e.year }}</h1>
            <p>{{ e.name }}</p>
          </div>
        </header>

        <div class="launch-layout">
          <section class="panel official-launch-main">
            <h2>¿Cómo quieres realizarlo?</h2>
            <p class="muted">El contenido es el mismo; cambia la forma de corrección.</p>

            <div class="launch-mode-grid">
              <button class="launch-mode" [class.selected]="mode==='EXAM'" (click)="mode='EXAM'">
                <span class="launch-mode-icon">📝</span>
                <div>
                  <strong>Modo examen</strong>
                  <p>No verás la corrección hasta terminar.</p>
                </div>
                <span class="radio-dot"></span>
              </button>

              <button class="launch-mode" [class.selected]="mode==='PRACTICE'" (click)="mode='PRACTICE'">
                <span class="launch-mode-icon">⚡</span>
                <div>
                  <strong>Modo práctico</strong>
                  <p>Corrige cada respuesta al instante.</p>
                </div>
                <span class="radio-dot"></span>
              </button>
            </div>

            <button class="btn primary wide launch-button" (click)="start()">
              INICIAR {{ mode==='EXAM' ? 'EXAMEN' : 'PRÁCTICA' }}
            </button>
          </section>

          <aside class="panel official-launch-side">
            <div class="official-emblem">🏛</div>
            <span class="eyebrow">CONVOCATORIA</span>
            <h2>{{ e.municipality }}</h2>
            <div class="launch-info-row"><span>Año</span><strong>{{ e.year }}</strong></div>
            <div class="launch-info-row"><span>Modalidad</span><strong>{{ mode==='EXAM' ? 'Examen' : 'Práctica' }}</strong></div>
          </aside>
        </div>
      }
    }
  `
})
export class OfficialExamDetailComponent implements OnInit {
  exam = signal<OfficialExam | null>(null);
  loading = signal(true);
  mode: TestMode = 'EXAM';

  constructor(private route: ActivatedRoute, private router: Router, private data: DataService) {}

  async ngOnInit() {
    try {
      this.exam.set(await this.data.getExam(this.route.snapshot.paramMap.get('id')!));
    } finally {
      this.loading.set(false);
    }
  }

  start() {
    this.router.navigate(['/app/oficiales', this.exam()!.id, 'realizar'], {
      queryParams: { mode: this.mode }
    });
  }
}
