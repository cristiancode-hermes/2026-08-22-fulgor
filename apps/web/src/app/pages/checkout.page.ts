import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Arena, MenuItem, Mission, SlotView } from '../shared/models';
import { eur, remainingLabel } from '../shared/format';

@Component({
  selector: 'app-checkout-page',
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container checkout-grid">
        <div>
          <h1>Retener arena</h1>
          @if (slot(); as s) {
            <p>{{ s.arena?.name || arena()?.name }} · {{ s.date }} · {{ s.startTime }}–{{ s.endTime }}</p>
          }
          <div class="form-group">
            <label class="form-label">Jugadores (4–{{ arena()?.maxPlayers || 16 }})</label>
            <input class="input" type="number" min="4" [max]="arena()?.maxPlayers || 16"
              [ngModel]="partySize()" (ngModelChange)="partySize.set(+$event)" />
          </div>
          <h3>Misiones</h3>
          <div class="mission-picker">
            @for (m of missions(); track m.id) {
              <label class="check-row">
                <input type="checkbox" [checked]="selectedMissionIds().includes(m.id)" (change)="toggleMission(m.id)" />
                <span>{{ m.name }} <em class="text-sm">{{ m.minutes }} min</em></span>
              </label>
            }
          </div>
          <h3>Extras</h3>
          @for (it of menu(); track it.id) {
            <label class="check-row">
              <input type="checkbox" [checked]="addonIds().includes(it.id)" (change)="toggleAddon(it.id)" />
              <span>{{ it.name }} · {{ eur(it.priceCents) }}</span>
            </label>
          }
          <label class="check-row">
            <input type="checkbox" [checked]="extraHour()" (change)="extraHour.set(!extraHour())" />
            <span>Hora extra</span>
          </label>
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          @if (!hold()) {
            <button class="btn btn-primary" (click)="doHold()" [disabled]="busy() || !canHold()">
              {{ busy() ? 'Reteniendo…' : 'Retener 15 min' }}
            </button>
          } @else {
            <p class="mono">Hold {{ remainingLabel(hold()!.expiresAt, nowMs()) }}</p>
            <button class="btn btn-primary" (click)="doConfirm()" [disabled]="busy()">Pagar y confirmar</button>
          }
        </div>
        <aside class="summary-panel">
          <h3>Resumen</h3>
          <ul class="summary-lines">
            <li>Base {{ partySize() }} × {{ eur(arena()?.priceCentsPerPlayer || 0) }}</li>
            @if (extraHour()) { <li>Hora extra</li> }
            @for (it of selectedAddons(); track it.id) { <li>{{ it.name }}</li> }
          </ul>
          <p class="total">Total {{ eur(liveTotalCents()) }}</p>
          <p class="text-sm">{{ selectedMissionIds().length }} misiones en cola</p>
        </aside>
      </div>
    </div>
  `,
})
export class CheckoutPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly slot = signal<SlotView | null>(null);
  protected readonly arena = signal<Arena | null>(null);
  protected readonly missions = signal<Mission[]>([]);
  protected readonly menu = signal<MenuItem[]>([]);
  protected readonly partySize = signal(8);
  protected readonly selectedMissionIds = signal<number[]>([]);
  protected readonly addonIds = signal<number[]>([]);
  protected readonly extraHour = signal(false);
  protected readonly hold = signal<{ id: number; expiresAt?: string | null } | null>(null);
  protected readonly nowMs = signal(Date.now());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  readonly eur = eur;
  readonly remainingLabel = remainingLabel;

  protected readonly selectedAddons = computed(() =>
    this.menu().filter((m) => this.addonIds().includes(m.id)),
  );
  protected readonly liveTotalCents = computed(() => {
    const a = this.arena();
    if (!a) return 0;
    let total = a.priceCentsPerPlayer * this.partySize();
    if (this.extraHour()) total += a.priceCentsPerPlayer * this.partySize();
    for (const it of this.selectedAddons()) total += it.priceCents;
    return total;
  });
  protected readonly canHold = computed(() => {
    const a = this.arena();
    const n = this.partySize();
    return !!a && n >= (a.minPlayers || 4) && n <= a.maxPlayers && this.selectedMissionIds().length > 0;
  });

  ngOnInit(): void {
    if (!this.auth.getToken()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const slotId = Number(this.route.snapshot.paramMap.get('slotId'));
    this.api.slot(slotId).subscribe({
      next: (res) => {
        this.slot.set(res.slot);
        this.arena.set(res.arena || (res.slot.arena as Arena));
      },
      error: () => this.error.set('Franja no encontrada'),
    });
    this.api.missions().subscribe({ next: (r) => this.missions.set(r.items || []) });
    this.api.menu().subscribe({ next: (r) => this.menu.set(r.items || []) });
    this.timer = setInterval(() => this.nowMs.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  @HostListener('document:visibilitychange')
  @HostListener('window:focus')
  resync(): void {
    this.nowMs.set(Date.now());
  }

  protected toggleMission(id: number): void {
    const cur = this.selectedMissionIds();
    this.selectedMissionIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  protected toggleAddon(id: number): void {
    const cur = this.addonIds();
    this.addonIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  protected doHold(): void {
    const s = this.slot();
    if (!s) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .hold({
        slotId: s.id,
        partySize: this.partySize(),
        missionIds: this.selectedMissionIds(),
        addonIds: this.addonIds(),
        extraHour: this.extraHour(),
      })
      .subscribe({
        next: (res) => {
          this.hold.set({ id: res.booking.id, expiresAt: res.expiresAt });
          this.busy.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'No se pudo retener');
          this.busy.set(false);
        },
      });
  }

  protected doConfirm(): void {
    const h = this.hold();
    if (!h) return;
    this.busy.set(true);
    this.api.confirm(h.id).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/reservas', h.id, 'confirmacion']);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Pago no válido');
        this.busy.set(false);
      },
    });
  }
}
