import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../core/api.service';
import { eur } from '../shared/format';
import { STATUS_LABELS } from '../shared/models';

@Component({
  selector: 'app-booking-detail',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container">
        @if (notFound()) {
          <div class="empty-state"><h1>Partida no encontrada</h1><a routerLink="/mis-partidas" class="btn btn-primary">Volver</a></div>
        } @else if (booking(); as b) {
          <h1>{{ b.slot?.arena?.name }}</h1>
          <p>{{ STATUS_LABELS[b.status] }} · {{ b.slot?.date }} {{ b.slot?.startTime }} · {{ eur(b.totalCents) }}</p>
          @if (qr()) { <div class="qr-box" [innerHTML]="qr()"></div> }
          <h3>Líneas</h3>
          <ul>
            @for (l of lines(); track l.id) {
              <li>{{ l.label }} × {{ l.qty }} — {{ eur(l.amountCents || l.subtotalCents || 0) }}</li>
            }
          </ul>
          <p class="total">Total {{ eur(totalCents()) }}</p>
          <h3>Cola</h3>
          <ul class="queue-board">
            @for (e of queue(); track e.id) {
              <li [class.playing]="e.status === 'playing'">
                <span>{{ e.position }}. {{ e.mission?.name }}</span>
                <span class="badge">{{ e.status }}</span>
                @if (e.status === 'queued') {
                  <button class="btn btn-ghost btn-sm" (click)="move(e.id, -1)">↑</button>
                  <button class="btn btn-ghost btn-sm" (click)="move(e.id, 1)">↓</button>
                }
                @if (e.status === 'playing') {
                  <button class="btn btn-secondary btn-sm" (click)="advance(e.id)">Siguiente</button>
                }
              </li>
            }
          </ul>
          @if (b.status === 'confirmed' || b.status === 'pending') {
            <button class="btn btn-ghost" (click)="cancel()">Cancelar</button>
          }
          @if (error()) { <p class="form-error">{{ error() }}</p> }
        }
      </div>
    </div>
  `,
})
export class BookingDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly booking = signal<any | null>(null);
  protected readonly lines = signal<any[]>([]);
  protected readonly queue = signal<any[]>([]);
  protected readonly qr = signal<SafeHtml | null>(null);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');
  readonly eur = eur;
  readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly totalCents = computed(() =>
    this.lines().reduce((s, l) => s + (l.amountCents || l.subtotalCents || 0), 0),
  );

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.booking(id).subscribe({
      next: (res) => {
        this.booking.set(res.booking);
        this.lines.set(res.lines || res.booking?.lines || []);
        this.queue.set(res.queue || []);
        const svg = res.qrSvg || res.booking?.qrSvg;
        if (svg) this.qr.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      },
      error: (err) => this.notFound.set(err?.status === 404),
    });
  }

  protected move(id: number, dir: number): void {
    const q = [...this.queue()];
    const queued = q.filter((e) => e.status === 'queued');
    const idx = queued.findIndex((e) => e.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= queued.length) return;
    const tmp = queued[idx];
    queued[idx] = queued[swap];
    queued[swap] = tmp;
    const playing = q.filter((e) => e.status === 'playing').map((e) => e.id);
    const ordered = [...playing, ...queued.map((e) => e.id)];
    this.api.reorder(this.booking().id, ordered).subscribe({
      next: (res) => this.queue.set(res.queue),
      error: (err) => this.error.set(err?.error?.message || 'No se pudo reordenar'),
    });
  }

  protected advance(entryId: number): void {
    this.api.advance(this.booking().id, entryId).subscribe({
      next: (res) => this.queue.set(res.queue),
    });
  }

  protected cancel(): void {
    this.api.cancel(this.booking().id).subscribe({
      next: () => this.reload(),
      error: (err) => this.error.set(err?.error?.message || 'No se pudo cancelar'),
    });
  }
}
