import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import type { Arena } from '../shared/models';
import { eur } from '../shared/format';

@Component({
  selector: 'app-arenas-catalogue',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="page">
      <div class="container">
        <div class="page-header">
          <div>
            <h1>Arenas</h1>
            <p class="lead">{{ freeSlotsToday() }} huecos hoy en todo el hangar.</p>
          </div>
        </div>
        <div class="filters">
          <input class="input" placeholder="Buscar" [ngModel]="q()" (ngModelChange)="q.set($event); load()" />
          <select class="input" [ngModel]="type()" (ngModelChange)="type.set($event); load()">
            <option value="">Todos los tipos</option>
            @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
          </select>
        </div>
        @if (loading()) {
          <div class="skeleton-grid"><div class="skeleton"></div><div class="skeleton"></div></div>
        } @else if (error()) {
          <div class="error-banner">{{ error() }} <button class="btn btn-secondary" (click)="load()">Reintentar</button></div>
        } @else if (!items().length) {
          <div class="empty-state"><p>Ninguna arena coincide.</p></div>
        } @else {
          <div class="arena-grid">
            @for (a of items(); track a.id; let i = $index) {
              <a [routerLink]="['/arenas', a.id]" class="arena-card" [class.wide]="i % 5 === 0">
                <img [src]="a.photoUrl || ''" [alt]="a.name" />
                <div class="arena-card-body">
                  <h3>{{ a.name }}</h3>
                  <p>{{ a.type }} · {{ a.maxPlayers }} jugadores · {{ eur(a.priceCentsPerPlayer) }}</p>
                  <strong>{{ a.freeSlotsToday ?? 0 }} huecos hoy</strong>
                </div>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ArenasCataloguePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly items = signal<Arena[]>([]);
  protected readonly freeSlotsToday = signal(0);
  protected readonly q = signal('');
  protected readonly type = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  readonly types = ['bosque', 'almacen', 'neon', 'subterraneo', 'muelle', 'industria'];
  readonly eur = eur;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.arenas({ q: this.q() || undefined, type: this.type() || undefined }).subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.freeSlotsToday.set(res.freeSlotsToday ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar arenas.');
        this.loading.set(false);
      },
    });
  }
}
