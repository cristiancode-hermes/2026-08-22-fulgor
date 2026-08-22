import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container empty-state">
        <h1>Página no encontrada</h1>
        <a routerLink="/" class="btn btn-primary">Inicio</a>
      </div>
    </div>
  `,
})
export class NotFoundPageComponent {}
