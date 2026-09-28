import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, signal } from '@angular/core';

import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-date-filter',
  standalone: true,
  template: `
    <div class="toolbar-field">
      <span>{{ label }}</span>
      <details class="toolbar-picker date-filter" #menu (toggle)="toggled($event)">
        <summary [attr.aria-label]="label + ': ' + formattedValue()"><span class="date-filter-value" [class.placeholder]="!value" [attr.data-value]="formattedValue()" aria-hidden="true"></span><i class="bi bi-calendar3" aria-hidden="true"></i></summary>
        <section #popover class="date-popover" [class.opens-above]="position().placement === 'above'" [class.opens-below]="position().placement === 'below'" [style.top.px]="position().top" [style.left.px]="position().left">
          <header><button type="button" (click)="moveMonth(-1)" [attr.aria-label]="i18n.text('previousMonth')"><i class="bi bi-chevron-left"></i></button><strong>{{ monthLabel() }}</strong><button type="button" (click)="moveMonth(1)" [attr.aria-label]="i18n.text('nextMonth')"><i class="bi bi-chevron-right"></i></button></header>
          <div class="calendar-grid weekdays">@for (weekday of weekdays(); track $index) { <span>{{ weekday }}</span> }</div>
          <div class="calendar-grid days">@for (day of calendarDays(); track $index) { @if (day) { <button type="button" [class.selected]="isSelected(day)" [class.today]="isToday(day)" (click)="selectDay(day, menu)">{{ day }}</button> } @else { <span></span> } }</div>
          @if (includeTime) {
            <div class="calendar-time" aria-label="Horário">
              <label><span>HH</span><input type="number" min="0" max="23" inputmode="numeric" [value]="timeHour" (input)="updateTime('hour', $event)" /></label>
              <strong aria-hidden="true">:</strong>
              <label><span>MM</span><input type="number" min="0" max="59" inputmode="numeric" [value]="timeMinute" (input)="updateTime('minute', $event)" /></label>
            </div>
          }
          <footer><button type="button" (click)="clear(menu)">{{ i18n.text('clearDate') }}</button><button type="button" (click)="selectToday(menu)">{{ i18n.text('today') }}</button></footer>
        </section>
      </details>
    </div>
  `,
})
export class DateFilterComponent {
  @ViewChild('menu') private menu?: ElementRef<HTMLDetailsElement>;
  @ViewChild('popover') private popover?: ElementRef<HTMLElement>;
  @Input() label = '';
  @Input() value = '';
  @Input() includeTime = false;
  @Output() readonly valueChange = new EventEmitter<string>();

  private cursor = this.firstDay(this.value ? new Date(`${this.value}T12:00:00`) : new Date());
  timeHour = '12';
  timeMinute = '00';
  readonly position = signal<CalendarPosition>({ top: 0, left: 0, placement: 'below' });

  constructor(readonly i18n: I18nService) {}

  toggled(event: Event): void {
    const current = event.target as HTMLDetailsElement;
    if (!current.open) return;
    const selectedDate = this.value.slice(0, 10);
    this.cursor = this.firstDay(selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date());
    const selectedTime = this.value.slice(11, 16).split(':');
    if (selectedTime.length === 2) [this.timeHour, this.timeMinute] = selectedTime;
    current.closest('.list-toolbar')?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => {
      if (menu !== current) menu.removeAttribute('open');
    });
    requestAnimationFrame(() => this.reposition());
  }

  @HostListener('window:resize') onResize(): void { this.reposition(); }
  @HostListener('window:scroll') onScroll(): void { this.reposition(); }

  formattedValue(): string {
    const selectedDate = this.value.slice(0, 10);
    if (!selectedDate) return this.includeTime ? 'dd/mm/aaaa --:--' : 'dd/mm/aaaa';
    const formattedDate = new Intl.DateTimeFormat(this.i18n.locale()).format(new Date(`${selectedDate}T12:00:00`));
    return this.includeTime ? `${formattedDate} ${this.value.slice(11, 16) || `${this.timeHour}:${this.timeMinute}`}` : formattedDate;
  }

  monthLabel(): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { month: 'long', year: 'numeric' }).format(this.cursor);
  }

  weekdays(): string[] {
    return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'narrow' }).format(new Date(2024, 0, 7 + index)));
  }

  calendarDays(): (number | null)[] {
    const leading = this.cursor.getDay();
    const count = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 0).getDate();
    return [...Array<null>(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }

  moveMonth(offset: number): void { this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + offset, 1); }
  isSelected(day: number): boolean { return this.value.slice(0, 10) === this.dateValue(this.cursor.getFullYear(), this.cursor.getMonth(), day); }
  isToday(day: number): boolean { const today = new Date(); return today.getFullYear() === this.cursor.getFullYear() && today.getMonth() === this.cursor.getMonth() && today.getDate() === day; }
  selectDay(day: number, menu: HTMLDetailsElement): void { this.emit(this.withTime(this.dateValue(this.cursor.getFullYear(), this.cursor.getMonth(), day)), menu); }
  selectToday(menu: HTMLDetailsElement): void { const today = new Date(); this.cursor = this.firstDay(today); this.emit(this.withTime(this.dateValue(today.getFullYear(), today.getMonth(), today.getDate())), menu); }
  clear(menu: HTMLDetailsElement): void { this.emit('', menu); }

  updateTime(part: 'hour' | 'minute', event: Event): void {
    const maximum = part === 'hour' ? 23 : 59;
    const raw = Number((event.target as HTMLInputElement).value);
    const normalized = String(Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, maximum))).padStart(2, '0');
    if (part === 'hour') this.timeHour = normalized; else this.timeMinute = normalized;
    const selectedDate = this.value.slice(0, 10);
    if (selectedDate) this.valueChange.emit(this.withTime(selectedDate));
  }

  private emit(value: string, menu: HTMLDetailsElement): void { this.valueChange.emit(value); menu.removeAttribute('open'); }
  private reposition(): void {
    const menu = this.menu?.nativeElement;
    const popover = this.popover?.nativeElement;
    if (!menu?.open || !popover || typeof window === 'undefined') return;
    const anchor = menu.querySelector('summary')?.getBoundingClientRect();
    if (!anchor) return;
    this.position.set(calculateCalendarPosition(anchor, popover.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  }
  private firstDay(value: Date): Date { return new Date(value.getFullYear(), value.getMonth(), 1); }
  private dateValue(year: number, month: number, day: number): string { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
  private withTime(value: string): string { return this.includeTime ? `${value}T${this.timeHour}:${this.timeMinute}` : value; }
}

export interface CalendarPosition { top: number; left: number; placement: 'above' | 'below'; }

export function calculateCalendarPosition(anchor: Pick<DOMRect, 'top' | 'right' | 'bottom'>, popover: Pick<DOMRect, 'width' | 'height'>, viewportWidth: number, viewportHeight: number): CalendarPosition {
  const margin = 12;
  const gap = 7;
  const width = popover.width || 286;
  const height = popover.height || 320;
  const spaceAbove = anchor.top - margin - gap;
  const spaceBelow = viewportHeight - anchor.bottom - margin - gap;
  const placement = spaceBelow >= height || spaceBelow >= spaceAbove ? 'below' : 'above';
  const desiredTop = placement === 'below' ? anchor.bottom + gap : anchor.top - height - gap;
  return {
    top: Math.max(margin, Math.min(desiredTop, viewportHeight - height - margin)),
    left: Math.max(margin, Math.min(anchor.right - width, viewportWidth - width - margin)),
    placement,
  };
}
