import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-split">
      <div class="auth-visual" aria-hidden="true">
        <img src="https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="" />
        <div class="auth-visual-overlay">
          <span class="brand-mark">F</span>
          <h1>Fulgor</h1>
          <p>La arena es de un solo escuadrón. La misión que suena es una sola.</p>
        </div>
      </div>
      <div class="auth-form-side">
        <form class="auth-bare" (ngSubmit)="submit()" autocomplete="off">
          <a routerLink="/" class="brand"><span class="brand-mark">F</span> Fulgor</a>
          <h2>Entrar</h2>
          <p class="subtitle">Reserva tu arena</p>
          <div class="form-group">
            <label class="form-label" for="identifier">Usuario o email</label>
            <input id="identifier" class="input" name="identifier" type="text" autocomplete="off"
              [ngModel]="identifier()" (ngModelChange)="identifier.set($event)" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="password">Contraseña</label>
            <input id="password" class="input" name="password" type="password" autocomplete="new-password"
              [ngModel]="password()" (ngModelChange)="password.set($event)" required />
          </div>
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">
            {{ busy() ? 'Entrando…' : 'Entrar' }}
          </button>
          <div class="auth-demo">
            <strong class="text-ink">Cuenta de prueba</strong>
            <div><code>demo@fulgor.dev</code> · <code>demo1234</code></div>
            <div class="text-sm">Staff: <code>staff@fulgor.dev</code> · <code>demo1234</code></div>
          </div>
          <p class="auth-switch">¿Sin cuenta? <a routerLink="/registro">Regístrate</a></p>
        </form>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  public readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected submit(): void {
    this.error.set('');
    this.busy.set(true);
    this.auth.login(this.identifier().trim(), this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        void this.router.navigateByUrl(ret);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Credenciales inválidas');
        this.busy.set(false);
      },
    });
  }
}
