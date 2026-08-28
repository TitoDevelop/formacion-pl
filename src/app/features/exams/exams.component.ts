import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { OfficialExam } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="page-title">
      <div><span class="eyebrow">BANCO OFICIAL</span><h1>Exámenes oficiales</h1><p>Convocatorias importadas desde el banco universal.</p></div>
    </header>

    @if (loading()) {
      <div class="panel empty-state">Cargando exámenes…</div>
    } @else if (!exams().length) {
      <div class="panel empty-state">
        <h3>Todavía no hay exámenes</h3>
        <p>Un administrador debe importar primero un municipio/año.</p>
      </div>
    } @else {
      <div class="exam-grid">
        @for (exam of exams(); track exam.id) {
          <article class="exam-card">
            <div class="exam-year">{{ exam.year }}</div>
            <div class="exam-icon">🏛</div>
            <h2>{{ exam.municipality }}</h2>
            <p>{{ exam.name }}</p>
            <a class="btn primary wide" [routerLink]="['/app/oficiales', exam.id]">Ver examen</a>
          </article>
        }
      </div>
    }
  `
})
export class ExamsComponent implements OnInit {
  exams = signal<OfficialExam[]>([]);
  loading = signal(true);
  constructor(private data: DataService) {}
  async ngOnInit() {
    try { this.exams.set(await this.data.listOfficialExams()); }
    finally { this.loading.set(false); }
  }
}
