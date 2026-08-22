import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-check-in',
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container">
        <h1>Check-in</h1>
        <p>Introduce el código del ticket (cámara opcional — el input siempre está).</p>
        <form (ngSubmit)="submit()">
          <input class="input" name="code" autocomplete="off" [ngModel]="code()" (ngModelChange)="code.set($event)" placeholder="FLG-XXXXXX" />
          <button class="btn btn-primary" type="submit" [disabled]="busy()">Escanear</button>
        </form>
        @if (error()) { <p class="form-error">{{ error() }}</p> }
        @if (result(); as r) {
          <div class="success-box">
            <p>Check-in {{ r.booking?.code }} · {{ r.booking?.status }}</p>
            <p>Now playing: {{ playingName(r.queue) }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckInPageComponent {
  private readonly api = inject(ApiService);
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<any | null>(null);

  protected submit(): void {
    this.busy.set(true);
    this.error.set('');
    this.api.checkIn(this.code().trim()).subscribe({
      next: (r) => {
        this.result.set(r);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || err?.error?.code || 'Check-in fallido');
        this.busy.set(false);
      },
    });
  }

  protected playingName(queue: any[]): string {
    return queue?.find((e) => e.status === 'playing')?.mission?.name || '—';
  }
}
