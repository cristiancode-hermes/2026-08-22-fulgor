import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-review-form',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="container">
        <h1>Reseña</h1>
        <form (ngSubmit)="submit()">
          <label class="form-label">Nota 1–5</label>
          <input class="input" type="number" min="1" max="5" [ngModel]="rating()" (ngModelChange)="rating.set(+$event)" name="rating" />
          <textarea class="input" rows="4" [ngModel]="comment()" (ngModelChange)="comment.set($event)" name="comment"></textarea>
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          <button class="btn btn-primary" type="submit">Publicar</button>
          <a routerLink="/arenas" class="btn btn-ghost">Volver</a>
        </form>
      </div>
    </div>
  `,
})
export class ReviewFormPageComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly rating = signal(5);
  protected readonly comment = signal('');
  protected readonly error = signal('');

  protected submit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.review(id, this.rating(), this.comment()).subscribe({
      next: () => void this.router.navigate(['/arenas', id]),
      error: (err) => this.error.set(err?.error?.message || 'No se pudo publicar'),
    });
  }
}
