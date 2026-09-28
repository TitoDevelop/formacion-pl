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
      @if (info()) { <div class="form-info">{{ info() }}</div> }

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
                  <div class="student-actions">
                    @if (s.role !== 'ADMIN') {
                      <button
                        class="btn"
                        [class.danger-btn]="s.access_enabled"
                        [class.success-btn]="!s.access_enabled"
                        [disabled]="deletingUsers().has(s.id)"
                        (click)="toggle(s)">
                        {{ s.access_enabled ? 'Quitar acceso' : 'Dar acceso' }}
                      </button>
                    } @else {
                      <span class="muted">Administrador</span>
                    }
                    <button
                      class="btn"
                      [disabled]="s.id === auth.user()?.id || changingPasswords().has(s.id) || deletingUsers().has(s.id)"
                      [title]="s.id === auth.user()?.id ? 'No puedes cambiar tu propia contraseña desde aquí' : 'Cambiar contraseña'"
                      (click)="openPasswordDialog(s)">
                      {{ changingPasswords().has(s.id) ? 'Guardando...' : 'Cambiar contraseña' }}
                    </button>
                    <button
                      class="btn danger-btn"
                      [disabled]="s.id === auth.user()?.id || changingPasswords().has(s.id) || deletingUsers().has(s.id)"
                      [title]="s.id === auth.user()?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'"
                      (click)="openDeleteDialog(s)">
                      {{ deletingUsers().has(s.id) ? 'Eliminando...' : 'Eliminar' }}
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (passwordDialogStudent()) {
      <div class="mode-picker-backdrop" (click)="closePasswordDialog()">
        <section class="panel mode-picker admin-password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" (click)="$event.stopPropagation()">
          <button class="mode-picker-close" type="button" aria-label="Cerrar" (click)="closePasswordDialog()">×</button>
          <span class="eyebrow">ACCESO ALUMNO</span>
          <h2 id="password-dialog-title">Cambiar contraseña</h2>
          <p>
            Nueva contraseña para
            <strong>{{ passwordDialogStudent().full_name || passwordDialogStudent().email || 'este usuario' }}</strong>.
          </p>

          <label>Nueva contraseña</label>
          <input
            type="password"
            class="admin-password-input"
            [ngModel]="passwordValue()"
            (ngModelChange)="passwordValue.set($event)"
            placeholder="Mínimo 6 caracteres"
            autocomplete="new-password">

          @if (passwordError()) { <div class="form-error">{{ passwordError() }}</div> }

          <div class="exit-test-actions">
            <button class="btn" type="button" [disabled]="savingPassword()" (click)="closePasswordDialog()">Cancelar</button>
            <button class="btn primary" type="button" [disabled]="savingPassword()" (click)="savePasswordDialog()">
              {{ savingPassword() ? 'Guardando...' : 'Guardar contraseña' }}
            </button>
          </div>
        </section>
      </div>
    }

    @if (deleteDialogStudent()) {
      <div class="mode-picker-backdrop" (click)="closeDeleteDialog()">
        <section class="panel mode-picker admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" (click)="$event.stopPropagation()">
          <button class="mode-picker-close" type="button" aria-label="Cerrar" (click)="closeDeleteDialog()">×</button>
          <span class="eyebrow">ELIMINAR USUARIO</span>
          <h2 id="delete-dialog-title">Eliminar alumno</h2>
          <p>
            Vas a eliminar definitivamente a
            <strong>{{ deleteDialogStudent().full_name || deleteDialogStudent().email || 'este usuario' }}</strong>.
            Se borrarán también sus intentos, borradores y progreso.
          </p>

          @if (deleteError()) { <div class="form-error">{{ deleteError() }}</div> }

          <div class="exit-test-actions">
            <button class="btn" type="button" [disabled]="savingDelete()" (click)="closeDeleteDialog()">Cancelar</button>
            <button class="btn danger" type="button" [disabled]="savingDelete()" (click)="confirmDeleteDialog()">
              {{ savingDelete() ? 'Eliminando...' : 'Eliminar usuario' }}
            </button>
          </div>
        </section>
      </div>
    }
  `
})
export class AdminStudentsComponent implements OnInit {
  students = signal<any[]>([]);
  search = signal('');
  error = signal('');
  info = signal('');
  changingRoles = signal<Set<string>>(new Set());
  changingPasswords = signal<Set<string>>(new Set());
  deletingUsers = signal<Set<string>>(new Set());
  passwordDialogStudent = signal<any | null>(null);
  passwordValue = signal('Alpha2026!');
  passwordError = signal('');
  savingPassword = signal(false);
  deleteDialogStudent = signal<any | null>(null);
  deleteError = signal('');
  savingDelete = signal(false);

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

  openDeleteDialog(student: any) {
    if (student.id === this.auth.user()?.id) return;

    this.deleteDialogStudent.set(student);
    this.deleteError.set('');
    this.error.set('');
    this.info.set('');
  }

  closeDeleteDialog() {
    if (this.savingDelete()) return;

    this.deleteDialogStudent.set(null);
    this.deleteError.set('');
  }

  async confirmDeleteDialog() {
    const student = this.deleteDialogStudent();
    if (!student || student.id === this.auth.user()?.id) return;

    this.deletingUsers.update(ids => new Set(ids).add(student.id));
    this.savingDelete.set(true);
    this.deleteError.set('');
    this.error.set('');
    this.info.set('');

    try {
      await this.data.adminDeleteUser(student.id);
      this.students.update(list => list.filter(s => s.id !== student.id));
      this.info.set('Usuario eliminado correctamente.');
      this.deleteDialogStudent.set(null);
    } catch (e: any) {
      this.deleteError.set(e?.message ?? 'No se pudo eliminar el usuario.');
    } finally {
      this.savingDelete.set(false);
      this.deletingUsers.update(ids => {
        const next = new Set(ids);
        next.delete(student.id);
        return next;
      });
    }
  }

  openPasswordDialog(student: any) {
    if (student.id === this.auth.user()?.id) return;

    this.passwordDialogStudent.set(student);
    this.passwordValue.set('Alpha2026!');
    this.passwordError.set('');
    this.error.set('');
    this.info.set('');
  }

  closePasswordDialog() {
    if (this.savingPassword()) return;

    this.passwordDialogStudent.set(null);
    this.passwordValue.set('Alpha2026!');
    this.passwordError.set('');
  }

  async savePasswordDialog() {
    const student = this.passwordDialogStudent();
    if (!student || student.id === this.auth.user()?.id) return;

    const label = student.full_name || student.email || 'este usuario';
    const trimmed = this.passwordValue().trim();
    if (trimmed.length < 6) {
      this.passwordError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.changingPasswords.update(ids => new Set(ids).add(student.id));
    this.savingPassword.set(true);
    this.passwordError.set('');
    this.error.set('');
    this.info.set('');

    try {
      await this.data.adminSetUserPassword(student.id, trimmed);
      this.info.set(`Contraseña actualizada para ${label}.`);
      this.passwordDialogStudent.set(null);
      this.passwordValue.set('Alpha2026!');
    } catch (e: any) {
      this.passwordError.set(e?.message ?? 'No se pudo cambiar la contraseña.');
    } finally {
      this.savingPassword.set(false);
      this.changingPasswords.update(ids => {
        const next = new Set(ids);
        next.delete(student.id);
        return next;
      });
    }
  }
}
