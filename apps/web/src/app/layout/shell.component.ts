import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell" [class.nav-drawer-open]="menuOpen()">
      <header class="topnav">
        <div class="container topnav-inner">
          <a routerLink="/" class="brand" (click)="closeMenu()">
            <span class="brand-mark">F</span>
            <span>Fulgor</span>
          </a>
          <ul class="nav-links" id="primary-nav" [class.open]="menuOpen()">
            <li>
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMenu()">Inicio</a>
            </li>
            <li><a routerLink="/arenas" routerLinkActive="active" (click)="closeMenu()">Arenas</a></li>
            <li><a routerLink="/misiones" routerLinkActive="active" (click)="closeMenu()">Misiones</a></li>
            @if (auth.getToken()) {
              <li><a routerLink="/mis-partidas" routerLinkActive="active" (click)="closeMenu()">Mis partidas</a></li>
              <li><a routerLink="/cuenta" routerLinkActive="active" (click)="closeMenu()">Cuenta</a></li>
            }
            @if (auth.isStaff()) {
              <li><a routerLink="/staff" routerLinkActive="active" (click)="closeMenu()">Staff</a></li>
            }
            <li class="nav-drawer-actions">
              <button type="button" class="btn btn-ghost btn-sm" (click)="theme.toggle()">
                {{ theme.isDark() ? 'Claro' : 'Oscuro' }}
              </button>
              @if (auth.getToken()) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="auth.logout(); closeMenu()">Salir</button>
              } @else {
                <a routerLink="/login" class="btn btn-secondary btn-sm" (click)="closeMenu()">Entrar</a>
                <a routerLink="/registro" class="btn btn-primary btn-sm" (click)="closeMenu()">Registro</a>
              }
            </li>
          </ul>
          <div class="nav-actions desktop-only">
            <button type="button" class="btn btn-ghost btn-sm" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
              {{ theme.isDark() ? 'Claro' : 'Oscuro' }}
            </button>
            @if (auth.getToken()) {
              <span class="user-chip">
                <strong>{{ auth.user()?.username }}</strong>
                <span class="points-chip">{{ auth.user()?.points ?? 0 }} pts</span>
              </span>
              <button type="button" class="btn btn-secondary btn-sm" (click)="auth.logout()">Salir</button>
            } @else {
              <a routerLink="/login" class="btn btn-secondary btn-sm">Entrar</a>
              <a routerLink="/registro" class="btn btn-primary btn-sm">Registro</a>
            }
          </div>
          <button type="button" class="nav-toggle" (click)="menuOpen.update((v) => !v)" [attr.aria-expanded]="menuOpen()" aria-controls="primary-nav">
            <span class="nav-toggle-bars" [class.open]="menuOpen()"><span></span><span></span><span></span></span>
          </button>
        </div>
      </header>
      @if (menuOpen()) {
        <button type="button" class="nav-backdrop" aria-label="Cerrar menú" (click)="closeMenu()"></button>
      }
      <main class="app-main"><router-outlet /></main>
      <footer class="site-footer">
        <div class="container">
          <span>© Fulgor — arenas, cola y QR</span>
          <span class="text-sm">Polvo de Trazador · Europe/Madrid</span>
        </div>
      </footer>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  public readonly auth = inject(AuthService);
  public readonly theme = inject(ThemeService);
  protected readonly menuOpen = signal(false);

  ngOnInit(): void {
    this.auth.bootstrap();
  }
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth > 860) this.menuOpen.set(false);
  }
  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.menuOpen.set(false);
  }
}
