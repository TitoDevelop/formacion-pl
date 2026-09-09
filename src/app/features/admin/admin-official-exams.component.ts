import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { OfficialExam } from '../../core/models';

type AdminOfficialExam = OfficialExam & { attempt_count: number };

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ADMINISTRACION</span>
        <h1>Mantenimiento de oficiales</h1>
        <p>Archiva o recupera examenes oficiales sin borrar el historico de los alumnos.</p>
      </div>
    </header>

    <section class="metric-grid admin-metrics">
      <article class="metric"><span>Examenes</span><strong>{{ exams().length }}</strong><small>Total importados</small></article>
      <article class="metric"><span>Publicados</span><strong>{{ activeCount() }}</strong><small>Disponibles para alumnos</small></article>
      <article class="metric"><span>Archivados</span><strong>{{ archivedCount() }}</strong><small>Ocultos en la biblioteca</small></article>
      <article class="metric accent"><span>Intentos</span><strong>{{ attemptCount() }}</strong><small>Historico conservado</small></article>
    </section>

    <section class="panel">
      <div class="admin-toolbar official-admin-toolbar">
        <input
          class="search-input"
          placeholder="Buscar por nombre, municipio o ano..."
          [ngModel]="search()"
          (ngModelChange)="search.set($event)">

        <select
          class="status-filter"
          [ngModel]="status()"
          (ngModelChange)="status.set($event)">
          <option value="ALL">Todos</option>
          <option value="ACTIVE">Publicados</option>
          <option value="ARCHIVED">Archivados</option>
        </select>

        <button class="btn" (click)="load()" [disabled]="loading()">
          {{ loading() ? 'Cargando...' : 'Recargar' }}
        </button>
      </div>

      @if (error()) { <div class="form-error">{{ error() }}</div> }
      @if (success()) { <div class="form-info">{{ success() }}</div> }

      @if (loading()) {
        <div class="empty-state">Cargando examenes oficiales...</div>
      } @else {
        <div class="student-table-wrap">
          <table class="student-table official-admin-table">
            <thead>
              <tr>
                <th>Examen</th>
                <th>Municipio</th>
                <th>Ano</th>
                <th>Intentos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (exam of filtered(); track exam.id) {
                <tr>
                  <td>
                    <strong>{{ exam.name }}</strong>
                    @if (exam.call_name) { <small>{{ exam.call_name }}</small> }
                  </td>
                  <td>{{ exam.municipality }}</td>
                  <td>{{ exam.year }}</td>
                  <td>
                    <span class="attempt-count-pill" [class.has-attempts]="exam.attempt_count > 0">
                      {{ exam.attempt_count }}
                    </span>
                  </td>
                  <td>
                    <span class="access-pill" [class.on]="exam.active">
                      {{ exam.active ? 'Publicado' : 'Archivado' }}
                    </span>
                  </td>
                  <td class="actions-cell official-actions">
                    <a class="btn" [routerLink]="['/app/oficiales', exam.id]">Ver</a>
                    <button
                      class="btn"
                      [class.danger-btn]="exam.active"
                      [class.success-btn]="!exam.active"
                      [disabled]="changing().has(exam.id)"
                      (click)="toggle(exam)">
                      {{ exam.active ? 'Archivar' : 'Republicar' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <div class="empty-state">No hay examenes con los filtros actuales.</div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `
})
export class AdminOfficialExamsComponent implements OnInit {
  exams = signal<AdminOfficialExam[]>([]);
  search = signal('');
  status = signal<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  loading = signal(true);
  error = signal('');
  success = signal('');
  changing = signal<Set<string>>(new Set());

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.status();

    return this.exams().filter(exam => {
      const matchesStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' && exam.active) ||
        (status === 'ARCHIVED' && !exam.active);
      const matchesSearch = !q || `${exam.name} ${exam.municipality} ${exam.year}`.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  });

  activeCount = computed(() => this.exams().filter(exam => exam.active).length);
  archivedCount = computed(() => this.exams().filter(exam => !exam.active).length);
  attemptCount = computed(() => this.exams().reduce((sum, exam) => sum + exam.attempt_count, 0));

  constructor(private data: DataService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      this.exams.set(await this.data.adminListOfficialExams());
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar los examenes oficiales.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(exam: AdminOfficialExam) {
    const next = !exam.active;
    const action = next ? 'republicar' : 'archivar';
    const detail = exam.attempt_count
      ? ` Tiene ${exam.attempt_count} intento(s) guardado(s), que se conservaran.`
      : '';

    if (!confirm(`Se va a ${action} "${exam.name}".${detail} Continuar?`)) return;

    this.changing.update(ids => new Set(ids).add(exam.id));
    this.error.set('');
    this.success.set('');

    try {
      await this.data.adminSetOfficialExamActive(exam.id, next);
      this.exams.update(list =>
        list.map(item => item.id === exam.id ? { ...item, active: next } : item)
      );
      this.success.set(next ? 'Examen republicado.' : 'Examen archivado. Ya no aparecera a los alumnos.');
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo cambiar el estado del examen.');
    } finally {
      this.changing.update(ids => {
        const nextIds = new Set(ids);
        nextIds.delete(exam.id);
        return nextIds;
      });
    }
  }
}
