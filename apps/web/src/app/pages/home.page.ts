import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import type { Arena } from '../shared/models';
import { eur } from '../shared/format';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <section class="hero-hangar">
      <div class="container hero-grid">
        <div>
          <h1>La arena es de un solo escuadrón.</h1>
          <p class="lead">Seis recintos indoor. Franjas de 60 minutos. Cola de misiones en vivo y ticket QR en el móvil.</p>
          <div class="row-between">
            <a routerLink="/arenas" class="btn btn-primary">Reservar partida</a>
            <span class="text-sm text-ink">{{ freeSlotsToday() }} huecos hoy</span>
          </div>
        </div>
        <img class="hero-photo" src="https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=1400" alt="Nave industrial Fulgor" />
      </div>
    </section>
    <section class="page">
      <div class="container">
        <div class="page-header">
          <h2>Arenas destacadas</h2>
          <a routerLink="/arenas">Ver catálogo</a>
        </div>
        @if (loading()) {
          <div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
        } @else if (error()) {
          <div class="error-banner">{{ error() }} <button class="btn btn-secondary" (click)="load()">Reintentar</button></div>
        } @else if (!items().length) {
          <div class="empty-state"><p>No hay arenas activas.</p><a class="btn btn-primary" routerLink="/arenas">Explorar</a></div>
        } @else {
          <div class="arena-mosaic">
            @for (a of items(); track a.id; let i = $index) {
              <a [routerLink]="['/arenas', a.id]" class="arena-card" [class.wide]="i === 0" [class.tall]="i === 1">
                <img [src]="a.photoUrl || ''" [alt]="a.name" />
                <div class="arena-card-body">
                  <h3>{{ a.name }}</h3>
                  <p>{{ a.freeSlotsToday ?? 0 }} huecos hoy · {{ eur(a.priceCentsPerPlayer) }}/jugador</p>
                </div>
              </a>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class HomePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly items = signal<Arena[]>([]);
  protected readonly freeSlotsToday = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  readonly eur = eur;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.featured().subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.freeSlotsToday.set(res.freeSlotsToday ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el hangar.');
        this.loading.set(false);
      },
    });
  }
}
