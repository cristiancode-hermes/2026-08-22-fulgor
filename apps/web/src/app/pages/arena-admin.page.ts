import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import type { Arena } from '../shared/models';

@Component({
  selector: 'app-arena-admin',
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container">
        <h1>Arenas (staff)</h1>
        <ul>
          @for (a of items(); track a.id) {
            <li class="admin-row">
              <strong>{{ a.name }}</strong>
              <button class="btn btn-ghost btn-sm" (click)="toggle(a)">{{ a.active ? 'Desactivar' : 'Activar' }}</button>
            </li>
          }
        </ul>
        <h3>Nueva</h3>
        <form (ngSubmit)="create()">
          <input class="input" placeholder="slug" [ngModel]="slug()" (ngModelChange)="slug.set($event)" name="slug" />
          <input class="input" placeholder="nombre" [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" />
          <input class="input" type="number" placeholder="céntimos/jugador" [ngModel]="price()" (ngModelChange)="price.set(+$event)" name="price" />
          <button class="btn btn-primary" type="submit">Crear</button>
        </form>
      </div>
    </div>
  `,
})
export class ArenaAdminPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly items = signal<Arena[]>([]);
  protected readonly slug = signal('');
  protected readonly name = signal('');
  protected readonly price = signal(800);
  ngOnInit(): void {
    this.reload();
  }
  private reload(): void {
    this.api.arenas().subscribe({ next: (r) => this.items.set(r.items || []) });
  }
  protected toggle(a: Arena): void {
    this.api.patchArena(a.id, { active: !a.active }).subscribe({ next: () => this.reload() });
  }
  protected create(): void {
    this.api.saveArena({ slug: this.slug(), name: this.name(), priceCentsPerPlayer: this.price() }).subscribe({
      next: () => this.reload(),
    });
  }
}
