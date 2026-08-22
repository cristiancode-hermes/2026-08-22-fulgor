import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import type { Mission } from '../shared/models';

@Component({
  selector: 'app-missions-catalogue',
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container">
        <h1>Misiones</h1>
        <input class="input" placeholder="Buscar modo" [ngModel]="q()" (ngModelChange)="q.set($event); load()" />
        <div class="mission-grid">
          @for (m of items(); track m.id) {
            <article class="mission-card">
              <h3>{{ m.name }}</h3>
              <p class="text-sm">{{ m.mode }} · {{ m.minutes }} min</p>
              <p>{{ m.description }}</p>
            </article>
          }
        </div>
      </div>
    </div>
  `,
})
export class MissionsCataloguePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly items = signal<Mission[]>([]);
  protected readonly q = signal('');
  ngOnInit(): void {
    this.load();
  }
  protected load(): void {
    this.api.missions(this.q() || undefined).subscribe({ next: (r) => this.items.set(r.items || []) });
  }
}
