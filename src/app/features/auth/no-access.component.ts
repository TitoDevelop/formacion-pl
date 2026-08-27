import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  template: `
    <div class="auth-page corporate-auth">
      <div class="access-card corporate-access-card">
        <img class="access-logo" src="/alpha-logo.png" alt="Alpha Formación">
        <span class="eyebrow">ALPHA FORMACIÓN</span>
        <h1>Acceso pendiente</h1>
        <p>Tu cuenta está creada correctamente, pero todavía debe ser habilitada por un administrador.</p>
        <p class="muted">Cuando te den acceso, cierra sesión y vuelve a entrar.</p>
        <button class="btn primary wide" (click)="logout()">Cerrar sesión</button>
      </div>
    </div>
  `
})
export class NoAccessComponent {
  constructor(private auth: AuthService, private router: Router) {}

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
