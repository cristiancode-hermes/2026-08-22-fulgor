import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../core/api.service';
import { eur } from '../shared/format';
import { STATUS_LABELS } from '../shared/models';

@Component({
  selector: 'app-confirmation-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container confirm-wrap">
        @if (error()) {
          <div class="error-banner">{{ error() }} <a class="btn btn-secondary" routerLink="/mis-partidas">Mis partidas</a></div>
        } @else if (booking(); as b) {
          <h1>Partida confirmada</h1>
          <p class="mono">{{ b.code }} · {{ STATUS_LABELS[b.status] || b.status }}</p>
          <p>{{ b.slot?.arena?.name }} · {{ b.slot?.date }} {{ b.slot?.startTime }}</p>
          <p class="total">{{ eur(b.totalCents) }}</p>
          @if (qr()) {
            <div class="qr-box" [innerHTML]="qr()"></div>
          }
          <a class="btn btn-primary" [routerLink]="['/mis-partidas', b.id]">Ver detalle</a>
        }
      </div>
    </div>
  `,
})
export class ConfirmationPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly booking = signal<any | null>(null);
  protected readonly qr = signal<SafeHtml | null>(null);
  protected readonly error = signal('');
  readonly eur = eur;
  readonly STATUS_LABELS = STATUS_LABELS;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.booking(id).subscribe({
      next: (res) => {
        this.booking.set(res.booking);
        const svg = res.qrSvg || res.booking?.qrSvg;
        if (svg) this.qr.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      },
      error: () => this.error.set('Error inesperado'),
    });
  }
}
