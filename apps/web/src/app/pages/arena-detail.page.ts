import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import type { Arena, SlotView } from '../shared/models';
import { eur, sortNightSlots } from '../shared/format';

@Component({
  selector: 'app-arena-detail',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="page">
      <div class="container">
        @if (loading()) {
          <div class="skeleton"></div>
        } @else if (notFound()) {
          <div class="empty-state"><h1>Arena no encontrada</h1><a class="btn btn-primary" routerLink="/arenas">Catálogo</a></div>
        } @else if (error()) {
          <div class="error-banner">{{ error() }} <button class="btn btn-secondary" (click)="load()">Reintentar</button></div>
        } @else if (arena(); as a) {
          <div class="detail-split">
            <img class="detail-photo" [src]="a.photoUrl || ''" [alt]="a.name" />
            <div>
              <p class="text-sm">{{ a.type }} · dificultad {{ a.difficulty }}/5</p>
              <h1>{{ a.name }}</h1>
              <p>{{ a.description }}</p>
              <p class="text-ink">{{ a.minPlayers }}–{{ a.maxPlayers }} jugadores · {{ eur(a.priceCentsPerPlayer) }}/jugador</p>
              <p class="text-sm">{{ a.freeSlotsToday ?? 0 }} huecos hoy · nota {{ a.ratingAvg ?? 0 }} ({{ a.ratingCount ?? 0 }})</p>
              <a class="btn btn-ghost" [routerLink]="['/arenas', a.id, 'resena']">Escribir reseña</a>
            </div>
          </div>
          <div class="mt-5">
            <label class="form-label">Día</label>
            <input class="input" type="date" [ngModel]="date()" (ngModelChange)="date.set($event); loadSlots()" />
          </div>
          <div class="slot-grid mt-4">
            @for (s of slots(); track s.id) {
              <a
                class="slot-chip"
                [class.busy]="s.status !== 'free'"
                [class.disabled]="s.status !== 'free'"
                [routerLink]="s.status === 'free' ? ['/checkout', s.id] : null"
              >
                <span class="slot-time">{{ s.startTime }}</span>
                <span class="slot-state">{{ s.status === 'free' ? 'Libre' : s.status === 'blocked' ? 'Bloqueada' : 'Ocupada' }}</span>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ArenaDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly arena = signal<Arena | null>(null);
  protected readonly slots = signal<SlotView[]>([]);
  protected readonly date = signal(new Date().toISOString().slice(0, 10));
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notFound = signal(false);
  readonly eur = eur;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api.arena(id).subscribe({
      next: (res) => {
        this.arena.set(res.arena);
        this.loading.set(false);
        this.loadSlots();
      },
      error: (err) => {
        this.notFound.set(err?.status === 404);
        this.error.set(err?.status === 404 ? '' : 'Error inesperado');
        this.loading.set(false);
      },
    });
  }

  protected loadSlots(): void {
    const a = this.arena();
    if (!a) return;
    this.api.slots(a.id, this.date()).subscribe({
      next: (res) => this.slots.set(sortNightSlots(res.slots || [])),
      error: () => this.slots.set([]),
    });
  }
}
