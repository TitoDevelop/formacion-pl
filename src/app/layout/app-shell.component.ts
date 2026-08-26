import { Component, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-frame">
      <aside class="sidebar">
        <a class="brand" routerLink="/app/dashboard">
          <span class="brand-mark">α</span>
          <span><strong>ALPHA</strong><small>FORMACIÓN</small></span>
        </a>

        <nav>
          <a routerLink="/app/dashboard" routerLinkActive="active">⌂ <span>Inicio</span></a>
          <a routerLink="/app/oficiales" routerLinkActive="active">▣ <span>Exámenes oficiales</span></a>
          <a routerLink="/app/falladas" routerLinkActive="active">↻ <span>Preguntas falladas</span></a>
          @if (isAdmin()) {
            <div class="nav-label">ADMINISTRACIÓN</div>
            <a routerLink="/admin/importar" routerLinkActive="active">⇧ <span>Importar exámenes</span></a>
          }
        </nav>

        <button class="logout" (click)="logout()">Cerrar sesión</button>
      </aside>

      <section class="main-area">
        <header class="mobile-top">
          <a class="brand" routerLink="/app/dashboard"><span class="brand-mark">α</span><strong>ALPHA</strong></a>
          <span>{{ auth.profile()?.full_name || auth.user()?.email }}</span>
        </header>
        <main class="page"><router-outlet /></main>
      </section>
    </div>
  `
})
export class AppShellComponent {
  isAdmin = computed(() => this.auth.profile()?.role === 'ADMIN');
  constructor(public auth: AuthService, private router: Router) {}
  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
