import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-split">
      <div class="auth-visual" aria-hidden="true">
        <img src="https://images.pexels.com/photos/236705/pexels-photo-236705.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="" />
        <div class="auth-visual-overlay">
          <h1>Únete al hangar</h1>
          <p>Arma escuadrón. Elige misiones. Juega.</p>
        </div>
      </div>
      <div class="auth-form-side">
        <form class="auth-bare" (ngSubmit)="submit()" autocomplete="off">
          <a routerLink="/" class="brand"><span class="brand-mark">F</span> Fulgor</a>
          <h2>Registro</h2>
          <div class="form-group">
            <label class="form-label" for="username">Usuario</label>
            <input id="username" class="input" name="username" autocomplete="off" [ngModel]="username()" (ngModelChange)="username.set($event)" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input id="email" class="input" name="email" type="email" autocomplete="off" [ngModel]="email()" (ngModelChange)="email.set($event)" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="password">Contraseña</label>
            <input id="password" class="input" name="password" type="password" autocomplete="new-password" [ngModel]="password()" (ngModelChange)="password.set($event)" required />
          </div>
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">{{ busy() ? 'Creando…' : 'Crear cuenta' }}</button>
          <p class="auth-switch">¿Ya tienes cuenta? <a routerLink="/login">Entrar</a></p>
        </form>
      </div>
    </div>
  `,
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly username = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected submit(): void {
    this.error.set('');
    this.busy.set(true);
    this.auth.register({ username: this.username().trim(), email: this.email().trim(), password: this.password() }).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo registrar');
        this.busy.set(false);
      },
    });
  }
}
