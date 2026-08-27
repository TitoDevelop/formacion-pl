import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../core/data.service';
import { TestMode } from '../../core/models';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">REPASO PERSONAL</span>
        <h1>Preguntas para repasar</h1>
        <p>Crea un test solo con las preguntas que tú has marcado.</p>
      </div>
    </header>

    <div class="review-builder">
      <section class="panel review-hero">
        <div class="review-count">{{ total() }}</div>
        <h2>preguntas marcadas</h2>
        <p>Puedes marcarlas desde cualquier examen o test personalizado.</p>
      </section>

      <section class="panel builder-config">
        <label>Número de preguntas</label>
        <input type="number" min="1" [max]="Math.max(total(),1)" [(ngModel)]="count">

        <label>Modo</label>
        <div class="mode-grid">
          <button class="mode-card" [class.selected]="mode==='EXAM'" (click)="mode='EXAM'">
            <strong>📝 Examen</strong>
            <span>Resultado al finalizar.</span>
          </button>
          <button class="mode-card" [class.selected]="mode==='PRACTICE'" (click)="mode='PRACTICE'">
            <strong>⚡ Práctico</strong>
            <span>Corrección inmediata.</span>
          </button>
        </div>

        @if (!total()) {
          <div class="form-info">Todavía no has marcado ninguna pregunta para repasar.</div>
        }

        <button class="btn primary wide" (click)="start()" [disabled]="!total()">
          COMENZAR REPASO
        </button>
      </section>
    </div>
  `
})
export class ReviewTestComponent implements OnInit {
  total = signal(0);
  count = 20;
  mode: TestMode = 'PRACTICE';
  Math = Math;

  constructor(private data: DataService, private router: Router) {}

  async ngOnInit() {
    const total = await this.data.reviewCount();
    this.total.set(total);
    this.count = Math.min(20, Math.max(total, 1));
  }

  start() {
    this.router.navigate(['/app/test/repaso'], {
      queryParams: {
        count: Math.min(this.count, this.total()),
        mode: this.mode
      }
    });
  }
}
