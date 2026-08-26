import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-brand">
        <div class="auth-logo">α</div>
        <h1>ALPHA <span>FORMACIÓN</span></h1>
        <p>Preparación Policía Local · Comunitat Valenciana</p>
      </div>

      <section class="auth-card">
        <div class="tabs">
          <button [class.active]="mode==='login'" (click)="mode='login'">Acceder</button>
          <button [class.active]="mode==='register'" (click)="mode='register'">Crear cuenta</button>
        </div>

        @if (mode === 'register') {
          <label>Nombre</label>
          <input [(ngModel)]="fullName" placeholder="Tu nombre">
        }

        <label>Email</label>
        <input type="email" [(ngModel)]="email" placeholder="nombre@email.com">

        <label>Contraseña</label>
        <input type="password" [(ngModel)]="password" placeholder="Mínimo 6 caracteres">

        @if (error) { <div class="form-error">{{ error }}</div> }
        @if (info) { <div class="form-info">{{ info }}</div> }

        <button class="btn primary wide" (click)="submit()" [disabled]="loading">
          {{ loading ? 'Procesando…' : (mode === 'login' ? 'ENTRAR' : 'CREAR CUENTA') }}
        </button>
      </section>
    </div>
  `
})
export class LoginComponent {
  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  fullName = '';
  loading = false;
  error = '';
  info = '';

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
    this.loading = true;
    this.error = '';
    this.info = '';
    try {
      if (this.mode === 'login') {
        await this.auth.login(this.email, this.password);
        await this.router.navigate(['/app/dashboard']);
      } else {
        const result = await this.auth.register(this.email, this.password, this.fullName);
        if (result.data.session) {
          await this.router.navigate(['/app/dashboard']);
        } else {
          this.info = 'Cuenta creada. Revisa tu correo si Supabase tiene activada la confirmación por email.';
        }
      }
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo completar la operación.';
    } finally {
      this.loading = false;
    }
  }
}
