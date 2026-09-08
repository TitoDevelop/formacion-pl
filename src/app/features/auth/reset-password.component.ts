import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page corporate-auth">
      <section class="access-card corporate-access-card reset-card">
        <img class="access-logo" src="/alpha-logo.png" alt="Alpha Formación">
        <span class="eyebrow">NUEVA CONTRASEÑA</span>
        <h1>Restablecer acceso</h1>
        <p>Introduce una nueva contraseña para volver a entrar en tu zona de preparación.</p>

        <label>Nueva contraseña</label>
        <input type="password" [(ngModel)]="password" placeholder="Mínimo 6 caracteres">

        <label>Repetir contraseña</label>
        <input type="password" [(ngModel)]="confirmPassword" placeholder="Repite la contraseña">

        @if (error) { <div class="form-error">{{ error }}</div> }
        @if (info) { <div class="form-info">{{ info }}</div> }

        <button class="btn primary wide auth-submit" (click)="savePassword()" [disabled]="loading">
          {{ loading ? 'Guardando...' : 'GUARDAR CONTRASEÑA' }}
        </button>

        <button class="text-button auth-secondary-action" (click)="goToLogin()">Volver al acceso</button>
      </section>
    </div>
  `
})
export class ResetPasswordComponent {
  password = '';
  confirmPassword = '';
  loading = false;
  error = '';
  info = '';

  constructor(private auth: AuthService, private router: Router) {}

  async savePassword() {
    this.error = '';
    this.info = '';

    if (this.password.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.loading = true;

    try {
      await this.auth.updatePassword(this.password);
      this.info = 'Contraseña actualizada correctamente. Ya puedes acceder con la nueva contraseña.';
      setTimeout(() => void this.router.navigate(['/login']), 1300);
    } catch (e: any) {
      this.error = this.getFriendlyError(e);
    } finally {
      this.loading = false;
    }
  }

  async goToLogin() {
    await this.router.navigate(['/login']);
  }

  private getFriendlyError(error: any): string {
    const message = String(error?.message ?? '').toLowerCase();

    if (message.includes('different from the old password')) {
      return 'La nueva contraseña debe ser distinta a la anterior.';
    }

    if (message.includes('password should be at least') || message.includes('password must be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (message.includes('weak password')) {
      return 'La contraseña es demasiado débil. Prueba con una más larga o menos común.';
    }

    if (message.includes('auth session missing') || message.includes('expired') || message.includes('invalid')) {
      return 'El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo desde la pantalla de acceso.';
    }

    return 'No se pudo actualizar la contraseña. Abre de nuevo el enlace del email.';
  }
}
