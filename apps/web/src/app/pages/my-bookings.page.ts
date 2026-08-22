import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { eur } from '../shared/format';
import { STATUS_LABELS } from '../shared/models';

@Component({
  selector: 'app-my-bookings',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container">
        <h1>Mis partidas</h1>
        @if (loading()) {
          <div class="skeleton"></div>
        } @else if (!items().length) {
          <div class="empty-state"><p>Aún no hay partidas.</p><a class="btn btn-primary" routerLink="/arenas">Reservar</a></div>
        } @else {
          <ul class="booking-list">
            @for (b of items(); track b.id) {
              <li>
                <a [routerLink]="['/mis-partidas', b.id]" class="booking-row">
                  <strong>{{ b.slot?.arena?.name || 'Arena' }}</strong>
                  <span>{{ b.slot?.date }} {{ b.slot?.startTime }}</span>
                  <span>{{ STATUS_LABELS[b.status] || b.status }}</span>
                  <span class="mono">{{ eur(b.totalCents) }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
})
export class MyBookingsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly items = signal<any[]>([]);
  protected readonly loading = signal(true);
  readonly eur = eur;
  readonly STATUS_LABELS = STATUS_LABELS;

  ngOnInit(): void {
    this.api.bookings().subscribe({
      next: (res) => {
        this.items.set(res.items || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
