import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import type { Arena, SlotView } from '../shared/models';
import { sortNightSlots } from '../shared/format';

@Component({
  selector: 'app-slot-admin',
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container">
        <h1>Franjas</h1>
        <select class="input" [ngModel]="arenaId()" (ngModelChange)="arenaId.set(+$event); loadSlots()">
          @for (a of arenas(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
        <input class="input" type="date" [ngModel]="date()" (ngModelChange)="date.set($event); loadSlots()" />
        <button class="btn btn-secondary" (click)="generate()">Generar día</button>
        <div class="slot-grid mt-4">
          @for (s of slots(); track s.id) {
            <button type="button" class="slot-chip" [class.busy]="s.blocked || s.status !== 'free'" (click)="toggle(s)">
              <span class="slot-time">{{ s.startTime }}</span>
              <span class="slot-state">{{ s.blocked ? 'Bloqueada' : s.status }}</span>
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class SlotAdminPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly arenas = signal<Arena[]>([]);
  protected readonly slots = signal<SlotView[]>([]);
  protected readonly arenaId = signal(0);
  protected readonly date = signal(new Date().toISOString().slice(0, 10));

  ngOnInit(): void {
    this.api.arenas().subscribe({
      next: (r) => {
        this.arenas.set(r.items || []);
        if (r.items[0]) this.arenaId.set(r.items[0].id);
        this.loadSlots();
      },
    });
  }
  protected loadSlots(): void {
    if (!this.arenaId()) return;
    this.api.slots(this.arenaId(), this.date()).subscribe({
      next: (r) => this.slots.set(sortNightSlots(r.slots || [])),
    });
  }
  protected generate(): void {
    this.api.generateSlots(this.arenaId(), this.date()).subscribe({ next: () => this.loadSlots() });
  }
  protected toggle(s: SlotView): void {
    this.api.blockSlot(s.id, !s.blocked).subscribe({ next: () => this.loadSlots() });
  }
}
