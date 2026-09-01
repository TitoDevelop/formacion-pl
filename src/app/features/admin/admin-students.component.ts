import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <header class="page-title">
      <div>
        <span class="eyebrow">ADMINISTRACIÓN</span>
        <h1>Control de alumnos</h1>
        <p>Autoriza o bloquea el acceso a la academia.</p>
      </div>
    </header>

    <section class="metric-grid admin-metrics">
      <article class="metric"><span>Usuarios</span><strong>{{ students().length }}</strong><small>Total registrados</small></article>
      <article class="metric"><span>Con acceso</span><strong>{{ enabledCount() }}</strong><small>Alumnos habilitados</small></article>
      <article class="metric"><span>Pendientes</span><strong>{{ pendingCount() }}</strong><small>Esperando autorización</small></article>
      <article class="metric accent"><span>Administradores</span><strong>{{ adminCount() }}</strong><small>Acceso completo</small></article>
    </section>

    <section class="panel">
      <div class="admin-toolbar">
        <input
          class="search-input"
          placeholder="Buscar por nombre o email..."
          [ngModel]="search()"
          (ngModelChange)="search.set($event)">
        <button class="btn" (click)="load()">Recargar</button>
      </div>

      @if (error()) { <div class="form-error">{{ error() }}</div> }

      <div class="student-table-wrap">
        <table class="student-table">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Acceso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.id) {
              <tr>
                <td><strong>{{ s.full_name || 'Sin nombre' }}</strong></td>
                <td>{{ s.email || '—' }}</td>
                <td>
                  <select
                    class="role-select"
                    [class.admin]="s.role==='ADMIN'"
                    [ngModel]="s.role"
                    [disabled]="s.id === auth.user()?.id || changingRoles().has(s.id)"
                    [attr.aria-label]="'Rol de ' + (s.full_name || s.email || 'usuario')"
                    (ngModelChange)="changeRole(s, $event)">
                    <option value="STUDENT">Alumno</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                  @if (s.id === auth.user()?.id) { <small class="own-role-note">Tu cuenta</small> }
                </td>
                <td>
                  <span class="access-pill" [class.on]="s.access_enabled || s.role==='ADMIN'">
                    {{ s.access_enabled || s.role==='ADMIN' ? 'Habilitado' : 'Pendiente / bloqueado' }}
                  </span>
                </td>
                <td class="actions-cell">
                  @if (s.role !== 'ADMIN') {
                    <button
                      class="btn"
                      [class.danger-btn]="s.access_enabled"
                      [class.success-btn]="!s.access_enabled"
                      (click)="toggle(s)">
                      {{ s.access_enabled ? 'Quitar acceso' : 'Dar acceso' }}
                    </button>
                  } @else {
                    <span class="muted">Administrador</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class AdminStudentsComponent implements OnInit {
  students = signal<any[]>([]);
  search = signal('');
  error = signal('');
  changingRoles = signal<Set<string>>(new Set());

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.students();

    return this.students().filter(s =>
      `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(q)
    );
  });

  enabledCount = computed(() =>
    this.students().filter(s => s.access_enabled && s.role !== 'ADMIN').length
  );

  pendingCount = computed(() =>
    this.students().filter(s => !s.access_enabled && s.role !== 'ADMIN').length
  );

  adminCount = computed(() =>
    this.students().filter(s => s.role === 'ADMIN').length
  );

  constructor(
    private data: DataService,
    public auth: AuthService
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.error.set('');
    try {
      this.students.set(await this.data.adminListStudents());
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudieron cargar los alumnos.');
    }
  }

  async toggle(student: any) {
    const next = !student.access_enabled;

    try {
      await this.data.adminSetAccess(student.id, next);
      this.students.update(list =>
        list.map(s => s.id === student.id ? { ...s, access_enabled: next } : s)
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo cambiar el permiso.');
    }
  }

  async changeRole(student: any, role: 'STUDENT' | 'ADMIN') {
    if (student.id === this.auth.user()?.id || role === student.role) return;

    this.changingRoles.update(ids => new Set(ids).add(student.id));
    this.error.set('');

    try {
      await this.data.adminSetRole(student.id, role);
      this.students.update(list =>
        list.map(s => s.id === student.id ? { ...s, role } : s)
      );
    } catch (e: any) {
      this.error.set(e?.message ?? 'No se pudo cambiar el rol.');
    } finally {
      this.changingRoles.update(ids => {
        const next = new Set(ids);
        next.delete(student.id);
        return next;
      });
    }
  }
}
