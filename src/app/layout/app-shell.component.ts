import { Component, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-frame">
      <aside class="sidebar" [class.mobile-open]="menuOpen">
        <a class="brand brand-logo" routerLink="/app/dashboard">
          <img src="/alpha-logo.png" alt="Alpha Formación">
          <span class="brand-copy">
            <strong>ALPHA</strong>
            <small>FORMACIÓN POLICIAL</small>
          </span>
        </a>

        <nav>
          <a routerLink="/app/dashboard" routerLinkActive="active" (click)="closeMenu()">⌂ <span>Inicio</span></a>
          <a routerLink="/app/crear-test" routerLinkActive="active" (click)="closeMenu()">＋ <span>Crear test personalizado</span></a>
          <a routerLink="/app/tests" routerLinkActive="active" (click)="closeMenu()">▣ <span>Ver tests</span></a>
          <a routerLink="/app/repasar" routerLinkActive="active" (click)="closeMenu()">★ <span>Preguntas para repasar</span></a>
          <a routerLink="/app/falladas" routerLinkActive="active" (click)="closeMenu()">↻ <span>Preguntas falladas</span></a>

          @if (isAdmin()) {
            <div class="nav-label">ADMINISTRACIÓN</div>
            <a routerLink="/admin/alumnos" routerLinkActive="active" (click)="closeMenu()">♟ <span>Control de alumnos</span></a>
            <a routerLink="/admin/importar" routerLinkActive="active" (click)="closeMenu()">⇧ <span>Importar exámenes</span></a>
            <a routerLink="/admin/recursos" routerLinkActive="active" (click)="closeMenu()">▤ <span>Recursos por tema</span></a>
          }
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <span class="sidebar-avatar">{{ initials() }}</span>
            <div>
              <strong>{{ auth.profile()?.full_name || 'Usuario' }}</strong>
              <small>{{ auth.profile()?.role === 'ADMIN' ? 'Administrador' : 'Alumno' }}</small>
            </div>
          </div>
          <button class="logout" (click)="logout()">Cerrar sesión</button>
        </div>
      </aside>

      @if (menuOpen) {
        <button class="mobile-menu-backdrop" type="button" aria-label="Cerrar menú" (click)="closeMenu()"></button>
      }

      <section class="main-area">
        <header class="mobile-top">
          <button class="hamburger" type="button" [attr.aria-expanded]="menuOpen"
            aria-label="Abrir menú de navegación" (click)="menuOpen = !menuOpen">
            <span></span><span></span><span></span>
          </button>
          <a class="mobile-brand" routerLink="/app/dashboard">
            <img src="/alpha-logo.png" alt="Alpha Formación">
            <strong>ALPHA</strong>
          </a>
          <span>{{ auth.profile()?.full_name || auth.user()?.email }}</span>
        </header>

        <main class="page">
          <router-outlet />
        </main>
      </section>
    </div>
  `
})
export class AppShellComponent {
  menuOpen = false;
  isAdmin = computed(() => this.auth.profile()?.role === 'ADMIN');

  initials = computed(() => {
    const name = this.auth.profile()?.full_name || this.auth.user()?.email || 'A';
    return name
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  });

  constructor(public auth: AuthService, private router: Router) {}

  closeMenu() {
    this.menuOpen = false;
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
