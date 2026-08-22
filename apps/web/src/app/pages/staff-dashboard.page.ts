import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { eur } from '../shared/format';

@Component({
  selector: 'app-staff-dashboard',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container">
        <h1>Staff</h1>
        <nav class="staff-nav">
          <a routerLink="/staff/check-in" class="btn btn-primary">Check-in QR</a>
          <a routerLink="/staff/arenas" class="btn btn-secondary">Arenas</a>
          <a routerLink="/staff/franjas" class="btn btn-secondary">Franjas</a>
        </nav>
        <div class="kpi-row">
          <div class="kpi"><span>Ocupadas</span><strong>{{ occ()?.occupied ?? 0 }}/{{ occ()?.total ?? 0 }}</strong></div>
          <div class="kpi"><span>Ocupación</span><strong>{{ occ()?.pct ?? 0 }}%</strong></div>
        </div>
        <h3>Ingresos 7 días</h3>
        <svg class="chart" viewBox="0 0 640 220" role="img" aria-label="Ingresos 7 días">
          <line x1="40" y1="10" x2="40" y2="180" stroke="currentColor" />
          <line x1="40" y1="180" x2="620" y2="180" stroke="currentColor" />
          @for (p of bars(); track p.date) {
            <rect [attr.x]="p.x" [attr.y]="p.y" [attr.width]="p.w" [attr.height]="p.h" fill="var(--color-primary)">
              <title>{{ p.date }} · {{ eur(p.cents) }} · {{ p.bookings }} partidas</title>
            </rect>
            <text [attr.x]="p.x + p.w / 2" y="200" text-anchor="middle" font-size="11">{{ p.date.slice(5) }}</text>
          }
        </svg>
      </div>
    </div>
  `,
})
export class StaffDashboardPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly occ = signal<{ occupied: number; total: number; pct: number } | null>(null);
  protected readonly bars = signal<{ date: string; cents: number; bookings: number; x: number; y: number; w: number; h: number }[]>([]);
  readonly eur = eur;

  ngOnInit(): void {
    this.api.occupancy().subscribe({ next: (r) => this.occ.set(r) });
    this.api.revenue(7).subscribe({
      next: (r) => {
        const series = r.series || [];
        const max = Math.max(1, ...series.map((s) => s.cents));
        const w = 70;
        this.bars.set(
          series.map((s, i) => {
            const h = Math.round((s.cents / max) * 150);
            return { ...s, x: 50 + i * 80, y: 180 - h, w, h };
          }),
        );
      },
    });
  }
}
