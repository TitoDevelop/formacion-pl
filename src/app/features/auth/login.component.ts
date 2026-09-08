import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

type AuthMode = 'login' | 'register' | 'forgot';

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
            <span class="eyebrow">{{ headingEyebrow }}</span>
            <h2>{{ headingTitle }}</h2>
            <p>{{ headingText }}</p>
          </div>

          <div class="tabs">
            <button [class.active]="mode==='login'" (click)="setMode('login')">Acceder</button>
            <button [class.active]="mode==='register'" (click)="setMode('register')">Crear cuenta</button>
          </div>

          @if (mode === 'register') {
            <label>Nombre</label>
            <input [(ngModel)]="fullName" placeholder="Tu nombre">
          }

          <label>Email</label>
          <input type="email" [(ngModel)]="email" placeholder="nombre@email.com">

          @if (mode !== 'forgot') {
            <label>Contraseña</label>
            <input type="password" [(ngModel)]="password" placeholder="Mínimo 6 caracteres">
          }

          @if (error) { <div class="form-error">{{ error }}</div> }
          @if (info) { <div class="form-info">{{ info }}</div> }

          <button class="btn primary wide auth-submit" (click)="submit()" [disabled]="loading">
            {{ submitText }}
          </button>

          @if (mode === 'login') {
            <button class="text-button auth-secondary-action" (click)="setMode('forgot')">He olvidado mi contraseña</button>
          } @else if (mode === 'forgot') {
            <button class="text-button auth-secondary-action" (click)="setMode('login')">Volver al acceso</button>
          }

          <div class="auth-security">Acceso protegido - Supabase Auth</div>
        </section>
      </div>
    </div>
  `
})
export class LoginComponent {
  mode: AuthMode = 'login';
  email = '';
  password = '';
  fullName = '';
  loading = false;
  error = '';
  info = '';

  constructor(private auth: AuthService, private router: Router) {}

  get headingEyebrow(): string {
    if (this.mode === 'register') return 'NUEVA CUENTA';
    if (this.mode === 'forgot') return 'RECUPERAR ACCESO';
    return 'ACCESO ALUMNOS';
  }

  get headingTitle(): string {
    if (this.mode === 'register') return 'Crear cuenta';
    if (this.mode === 'forgot') return 'Restablecer contraseña';
    return 'Bienvenido de nuevo';
  }

  get headingText(): string {
    if (this.mode === 'register') return 'Tu acceso deberá ser validado por un administrador.';
    if (this.mode === 'forgot') return 'Te enviaremos un email para crear una contraseña nueva.';
    return 'Accede a tu zona de preparación.';
  }

  get submitText(): string {
    if (this.loading) return 'Procesando...';
    if (this.mode === 'register') return 'CREAR CUENTA';
    if (this.mode === 'forgot') return 'ENVIAR EMAIL';
    return 'ENTRAR EN ALPHA';
  }

  setMode(mode: AuthMode) {
    this.mode = mode;
    this.error = '';
    this.info = '';
  }

  async submit() {
    this.loading = true;
    this.error = '';
    this.info = '';

    try {
      if (this.mode === 'login') {
        if (!this.email || !this.password) {
          this.error = 'Introduce tu email y contraseña.';
          return;
        }

        await this.auth.login(this.email, this.password);

        if (!this.auth.hasAccess()) {
          await this.router.navigate(['/sin-acceso']);
          return;
        }

        await this.router.navigate(['/app/dashboard']);
      } else if (this.mode === 'forgot') {
        if (!this.email) {
          this.error = 'Introduce tu email para enviarte el enlace.';
          return;
        }

        await this.auth.requestPasswordReset(this.email);
        this.info = 'Te hemos enviado un email con el enlace para restablecer tu contraseña.';
      } else {
        if (!this.email || !this.password || !this.fullName) {
          this.error = 'Completa nombre, email y contraseña.';
          return;
        }

        const result = await this.auth.register(this.email, this.password, this.fullName);

        if (result.data.session) {
          await this.router.navigate(['/sin-acceso']);
        } else {
          this.info = 'Cuenta creada. Confirma tu email si es necesario. Después un administrador deberá habilitar tu acceso.';
        }
      }
    } catch (e: any) {
      this.error = this.getFriendlyError(e);
    } finally {
      this.loading = false;
    }
  }

  private getFriendlyError(error: any): string {
    const message = String(error?.message ?? '').toLowerCase();

    if (message.includes('invalid login credentials')) {
      return 'Email o contraseña incorrectos.';
    }

    if (message.includes('email not confirmed')) {
      return 'Debes confirmar tu email antes de acceder.';
    }

    if (message.includes('invalid email') || message.includes('email address is invalid')) {
      return 'Introduce un email válido.';
    }

    if (message.includes('password should be at least') || message.includes('password must be at least')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (message.includes('weak password')) {
      return 'La contraseña es demasiado débil. Prueba con una más larga o menos común.';
    }

    if (message.includes('already registered') || message.includes('already exists')) {
      return 'Ya existe una cuenta con ese email.';
    }

    if (message.includes('rate limit') || message.includes('security purposes')) {
      return 'Por seguridad, espera unos segundos antes de intentarlo de nuevo.';
    }

    return 'No se pudo completar la operación.';
  }
}
