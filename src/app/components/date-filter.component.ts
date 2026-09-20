import { Component, EventEmitter, Input, Output } from '@angular/core';

import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-date-filter',
  standalone: true,
  template: `
    <div class="toolbar-field">
      <span>{{ label }}</span>
      <details class="toolbar-picker date-filter" #menu (toggle)="toggled($event)">
        <summary [attr.aria-label]="label + ': ' + formattedValue()"><span class="date-filter-value" [class.placeholder]="!value" [attr.data-value]="formattedValue()" aria-hidden="true"></span><i class="bi bi-calendar3" aria-hidden="true"></i></summary>
        <section class="date-popover">
          <header><button type="button" (click)="moveMonth(-1)" [attr.aria-label]="i18n.text('previousMonth')"><i class="bi bi-chevron-left"></i></button><strong>{{ monthLabel() }}</strong><button type="button" (click)="moveMonth(1)" [attr.aria-label]="i18n.text('nextMonth')"><i class="bi bi-chevron-right"></i></button></header>
          <div class="calendar-grid weekdays">@for (weekday of weekdays(); track $index) { <span>{{ weekday }}</span> }</div>
          <div class="calendar-grid days">@for (day of calendarDays(); track $index) { @if (day) { <button type="button" [class.selected]="isSelected(day)" [class.today]="isToday(day)" (click)="selectDay(day, menu)">{{ day }}</button> } @else { <span></span> } }</div>
          <footer><button type="button" (click)="clear(menu)">{{ i18n.text('clearDate') }}</button><button type="button" (click)="selectToday(menu)">{{ i18n.text('today') }}</button></footer>
        </section>
      </details>
    </div>
  `,
})
export class DateFilterComponent {
  @Input() label = '';
  @Input() value = '';
  @Output() readonly valueChange = new EventEmitter<string>();

  private cursor = this.firstDay(this.value ? new Date(`${this.value}T12:00:00`) : new Date());

  constructor(readonly i18n: I18nService) {}

  toggled(event: Event): void {
    const current = event.target as HTMLDetailsElement;
    if (!current.open) return;
    this.cursor = this.firstDay(this.value ? new Date(`${this.value}T12:00:00`) : new Date());
    current.closest('.list-toolbar')?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => {
      if (menu !== current) menu.removeAttribute('open');
    });
  }

  formattedValue(): string {
    if (!this.value) return 'dd/mm/aaaa';
    return new Intl.DateTimeFormat(this.i18n.locale()).format(new Date(`${this.value}T12:00:00`));
  }

  monthLabel(): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long', year: 'numeric' }).format(this.cursor);
  }

  weekdays(): string[] {
    return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'narrow' }).format(new Date(2024, 0, 7 + index)));
  }

  calendarDays(): Array<number | null> {
    const leading = this.cursor.getDay();
    const count = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 0).getDate();
    return [...Array<null>(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }

  moveMonth(offset: number): void { this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + offset, 1); }
  isSelected(day: number): boolean { return this.value === this.dateValue(this.cursor.getFullYear(), this.cursor.getMonth(), day); }
  isToday(day: number): boolean { const today = new Date(); return today.getFullYear() === this.cursor.getFullYear() && today.getMonth() === this.cursor.getMonth() && today.getDate() === day; }
  selectDay(day: number, menu: HTMLDetailsElement): void { this.emit(this.dateValue(this.cursor.getFullYear(), this.cursor.getMonth(), day), menu); }
  selectToday(menu: HTMLDetailsElement): void { const today = new Date(); this.cursor = this.firstDay(today); this.emit(this.dateValue(today.getFullYear(), today.getMonth(), today.getDate()), menu); }
  clear(menu: HTMLDetailsElement): void { this.emit('', menu); }

  private emit(value: string, menu: HTMLDetailsElement): void { this.valueChange.emit(value); menu.removeAttribute('open'); }
  private firstDay(value: Date): Date { return new Date(value.getFullYear(), value.getMonth(), 1); }
  private dateValue(year: number, month: number, day: number): string { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
}
