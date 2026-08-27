import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (attempt(); as a) {
      <div class="result-wrap">
        <div class="result-score">{{ a.score }}</div>
        <span class="result-over">sobre 10</span>
        <h1>{{ a.title || 'Test corregido' }}</h1>
        <p>{{ a.mode === 'PRACTICE' ? 'Modo práctico' : 'Modo examen' }}</p>

        <div class="result-stats">
          <div><strong>{{ a.correct_answers }}</strong><span>Correctas</span></div>
          <div><strong>{{ a.wrong_answers }}</strong><span>Falladas</span></div>
          <div><strong>{{ a.blank_answers }}</strong><span>En blanco</span></div>
        </div>

        <div class="result-actions">
          <a routerLink="/app/falladas" class="btn">Ver falladas</a>
          <a routerLink="/app/repasar" class="btn">Repasar marcadas</a>
          <a routerLink="/app/tests" class="btn primary">Más tests</a>
        </div>
      </div>
    }
  `
})
export class ResultComponent implements OnInit {
  attempt = signal<any>(null);

  constructor(
    private route: ActivatedRoute,
    private data: DataService
  ) {}

  async ngOnInit() {
    this.attempt.set(
      await this.data.getAttempt(this.route.snapshot.paramMap.get('id')!)
    );
  }
}
