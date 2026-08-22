import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-account-page',
  template: `
    <div class="page">
      <div class="container">
        <h1>Cuenta</h1>
        <p>{{ auth.user()?.username }} · {{ auth.user()?.email }}</p>
        <p class="total">{{ auth.user()?.points ?? 0 }} pts</p>
        <h3>Emails simulados</h3>
        <ul>
          @for (e of emails(); track e.id) {
            <li><strong>{{ e.subject }}</strong><p class="text-sm">{{ e.body }}</p></li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class AccountPageComponent implements OnInit {
  public readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly emails = signal<any[]>([]);
  ngOnInit(): void {
    this.auth.refreshProfile();
    this.api.emails().subscribe({ next: (r) => this.emails.set(r.items || []) });
  }
}
