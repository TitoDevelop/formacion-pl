import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { OfficialExam, Topic } from '../../core/models';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">BANCO DE TESTS</span>
        <h1>Ver tests</h1>
        <p>Practica por temas o realiza exámenes oficiales completos.</p>
      </div>
    </header>

    <div class="test-library-tabs" role="tablist" aria-label="Tipo de tests">
      <button type="button" role="tab" [attr.aria-selected]="view() === 'topics'"
        [class.active]="view() === 'topics'" (click)="view.set('topics')">Temas</button>
      <button type="button" role="tab" [attr.aria-selected]="view() === 'official'"
        [class.active]="view() === 'official'" (click)="view.set('official')">Exámenes oficiales</button>
    </div>

    @if (view() === 'topics') {
    <section class="library-section" role="tabpanel">
      <div class="section-heading">
        <div><h2>Tests por temas</h2><p>Crea un test directamente sobre un bloque del temario.</p></div>
      </div>

      @if (loading()) {
        <div class="panel empty-state">Cargando banco…</div>
      } @else {
        <div class="topic-library">
          @for (topic of topics(); track topic.id) {
            <article class="topic-test-card">
              <div class="topic-big-number">{{ topic.number ?? '—' }}</div>
              <div class="topic-card-body">
                <h3>{{ topic.name }}</h3>
                <p>Ver disponibilidad y progreso del tema.</p>
                <a
                  class="text-link"
                  [routerLink]="['/app/temas', topic.id]">
                  Ver tema →
                </a>
              </div>
            </article>
          }
        </div>
      }
    </section>
    } @else {
    <section class="library-section" role="tabpanel">
      <div class="section-heading">
        <div><h2>Exámenes oficiales</h2><p>Convocatorias reales identificadas por municipio y año.</p></div>
      </div>

      @if (loading()) {
        <div class="panel empty-state">Cargando exámenes…</div>
      } @else {
      @if (years().length) {
        <div class="year-filter" aria-label="Filtrar exámenes por año">
          <button type="button" [class.active]="selectedYear() === null" (click)="selectedYear.set(null)">Todos</button>
          @for (year of years(); track year) {
            <button type="button" [class.active]="selectedYear() === year" (click)="selectedYear.set(year)">{{ year }}</button>
          }
        </div>
      }

      <div class="exam-grid">
        @for (exam of filteredExams(); track exam.id) {
          <article class="exam-card">
            <div class="exam-year">{{ exam.year }}</div>
            <div class="exam-icon">🏛</div>
            <h2>{{ exam.municipality }}</h2>
            <p>{{ exam.name }}</p>
            <a class="btn primary wide" [routerLink]="['/app/oficiales', exam.id]">
              Ver examen
            </a>
          </article>
        } @empty {
          <div class="panel empty-state">{{ exams().length ? 'No hay exámenes oficiales para el año seleccionado.' : 'Todavía no hay exámenes oficiales importados.' }}</div>
        }
      </div>
      }
    </section>
    }
  `
})
export class TestsLibraryComponent implements OnInit {
  topics = signal<Topic[]>([]);
  exams = signal<OfficialExam[]>([]);
  loading = signal(true);
  view = signal<'topics' | 'official'>('topics');
  selectedYear = signal<number | null>(null);
  years = computed(() => [...new Set(this.exams().map(exam => exam.year))].sort((a, b) => b - a));
  filteredExams = computed(() => {
    const year = this.selectedYear();
    return year === null ? this.exams() : this.exams().filter(exam => exam.year === year);
  });

  constructor(private data: DataService) {}

  async ngOnInit() {
    try {
      const [topics, exams] = await Promise.all([
        this.data.listTopics(),
        this.data.listOfficialExams()
      ]);

      this.topics.set(topics);
      this.exams.set(exams);
    } finally {
      this.loading.set(false);
    }
  }
}
