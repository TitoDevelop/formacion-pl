import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page corporate-auth">
      <div class="auth-layout">
        <section class="auth-visual">
          <div class="auth-brand-block">
            <img class="auth-real-logo" src="/alpha-logo.png" alt="Alpha Formación">
            <div>
              <span class="auth-kicker">CENTRO DE FORMACIÓN POLICIAL</span>
              <h1>ALPHA <span>FORMACIÓN</span></h1>
              <p>Tu preparación para Policía Local, estructurada para avanzar cada semana.</p>
            </div>
          </div>

          <div class="auth-highlights">
            <div><strong>Tests personalizados</strong><span>Por temas, dificultad y modo</span></div>
            <div><strong>Exámenes oficiales</strong><span>Municipios y convocatorias reales</span></div>
            <div><strong>Repaso inteligente</strong><span>Falladas y marcadas para volver sobre ellas</span></div>
          </div>
        </section>

        <section class="auth-card">
          <div class="auth-card-heading">
            <span class="eyebrow">{{ mode === 'login' ? 'ACCESO ALUMNOS' : 'NUEVA CUENTA' }}</span>
            <h2>{{ mode === 'login' ? 'Bienvenido de nuevo' : 'Crear cuenta' }}</h2>
            <p>{{ mode === 'login' ? 'Accede a tu zona de preparación.' : 'Tu acceso deberá ser validado por un administrador.' }}</p>
          </div>

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

          <button class="btn primary wide auth-submit" (click)="submit()" [disabled]="loading">
            {{ loading ? 'Procesando…' : (mode === 'login' ? 'ENTRAR EN ALPHA' : 'CREAR CUENTA') }}
          </button>

          <div class="auth-security">Acceso protegido · Supabase Auth</div>
        </section>
      </div>
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

        if (!this.auth.hasAccess()) {
          await this.router.navigate(['/sin-acceso']);
          return;
        }

        await this.router.navigate(['/app/dashboard']);
      } else {
        const result = await this.auth.register(this.email, this.password, this.fullName);

        if (result.data.session) {
          await this.router.navigate(['/sin-acceso']);
        } else {
          this.info = 'Cuenta creada. Confirma tu email si es necesario. Después un administrador deberá habilitar tu acceso.';
        }
      }
    } catch (e: any) {
      this.error = e?.message ?? 'No se pudo completar la operación.';
    } finally {
      this.loading = false;
    }
  }
}
