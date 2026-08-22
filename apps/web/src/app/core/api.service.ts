import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Arena, MenuItem, Mission, SlotView } from '../shared/models';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  featured(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<{ items: Arena[]; freeSlotsToday: number }>(`${API}/arenas/featured`, { params });
  }

  arenas(q?: { type?: string; q?: string; date?: string }) {
    let params = new HttpParams();
    if (q?.type) params = params.set('type', q.type);
    if (q?.q) params = params.set('q', q.q);
    if (q?.date) params = params.set('date', q.date);
    return this.http.get<{ items: Arena[]; total: number; freeSlotsToday: number }>(`${API}/arenas`, { params });
  }

  arena(id: number) {
    return this.http.get<{ arena: Arena; ratingAvg: number; ratingCount: number }>(`${API}/arenas/${id}`);
  }

  slots(arenaId: number, date: string) {
    return this.http.get<{ slots: SlotView[] }>(`${API}/arenas/${arenaId}/slots`, {
      params: new HttpParams().set('date', date),
    });
  }

  slot(id: number) {
    return this.http.get<{ slot: SlotView; arena: Arena }>(`${API}/slots/${id}`);
  }

  missions(q?: string, mode?: string) {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (mode) params = params.set('mode', mode);
    return this.http.get<{ items: Mission[]; total: number }>(`${API}/missions`, { params });
  }

  menu() {
    return this.http.get<{ items: MenuItem[] }>(`${API}/menu`);
  }

  hold(body: { slotId: number; partySize: number; missionIds: number[]; addonIds: number[]; extraHour?: boolean }) {
    return this.http.post<{ booking: any; expiresAt: string; lines: any[]; queue: any[]; totalCents: number }>(
      `${API}/bookings/hold`,
      body,
    );
  }

  confirm(id: number, paymentNonce = 'sim-ok') {
    return this.http.post<{ booking: any; code: string; qrSvg: string }>(`${API}/bookings/${id}/confirm`, {
      paymentNonce,
    });
  }

  bookings(status?: string) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<{ items: any[]; total: number }>(`${API}/bookings`, { params });
  }

  booking(id: number) {
    return this.http.get<{ booking: any; lines: any[]; queue: any[]; qrSvg: string | null; checkIn: any }>(
      `${API}/bookings/${id}`,
    );
  }

  cancel(id: number) {
    return this.http.post<{ booking: any }>(`${API}/bookings/${id}/cancel`, {});
  }

  reorder(id: number, orderedEntryIds: number[]) {
    return this.http.patch<{ queue: any[] }>(`${API}/bookings/${id}/queue`, { orderedEntryIds });
  }

  advance(id: number, entryId: number) {
    return this.http.post<{ queue: any[] }>(`${API}/bookings/${id}/queue/${entryId}/advance`, {});
  }

  review(arenaId: number, rating: number, comment: string) {
    return this.http.post(`${API}/arenas/${arenaId}/reviews`, { rating, comment });
  }

  emails() {
    return this.http.get<{ items: any[] }>(`${API}/emails`);
  }

  occupancy(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<{ occupied: number; total: number; pct: number }>(`${API}/stats/occupancy`, { params });
  }

  revenue(days = 7) {
    return this.http.get<{ series: { date: string; cents: number; bookings: number }[] }>(`${API}/stats/revenue`, {
      params: new HttpParams().set('days', String(days)),
    });
  }

  checkIn(code: string) {
    return this.http.post<{ booking: any; queue: any[]; checkIn: any }>(`${API}/staff/check-in`, { code });
  }

  generateSlots(arenaId: number, date: string) {
    return this.http.post<{ created: number }>(`${API}/arenas/${arenaId}/slots/generate`, { date });
  }

  blockSlot(id: number, blocked: boolean) {
    return this.http.patch(`${API}/slots/${id}/block`, { blocked });
  }

  saveArena(body: Partial<Arena> & { slug?: string; name: string; priceCentsPerPlayer: number }) {
    return this.http.post<{ arena: Arena }>(`${API}/arenas`, body);
  }

  patchArena(id: number, body: Partial<Arena>) {
    return this.http.patch<{ arena: Arena }>(`${API}/arenas/${id}`, body);
  }
}
