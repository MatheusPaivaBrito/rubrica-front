import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';

@Component({
  selector: 'app-one-time-code',
  standalone: true,
  template: `
    <div class="otp-group" role="group" [attr.aria-label]="label" (paste)="onPaste($event)">
      @for (digit of digits; track $index) {
        <input
          #digitInput
          class="otp-digit"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          [attr.maxlength]="$index === 0 ? 6 : 1"
          [attr.autocomplete]="$index === 0 ? 'one-time-code' : 'off'"
          [attr.aria-label]="label + ' ' + ($index + 1) + '/6'"
          [value]="digit"
          (input)="onInput($index, $event)"
          (keydown)="onKeydown($index, $event)"
          (focus)="selectInput($event)"
        />
      }
    </div>
  `,
  styles: [`
    .otp-group{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.55rem;width:100%}
    .otp-digit{width:100%;min-width:0;aspect-ratio:1/1;min-height:52px;padding:0;border:1px solid #cfd8e6;border-radius:11px;background:#fff;color:#18212f;text-align:center;font-size:1.45rem;font-weight:750;caret-color:#a82035}
    .otp-digit:focus{outline:3px solid rgba(168,32,53,.16);border-color:#a82035}
    @media(max-width:420px){.otp-group{gap:.35rem}.otp-digit{min-height:46px;font-size:1.25rem}}
  `],
})
export class OneTimeCodeComponent implements AfterViewInit {
  @Input() label = 'Authentication code';
  @Input() set value(value: string) { this.setDigits(value); }
  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly completed = new EventEmitter<string>();
  @ViewChildren('digitInput') private readonly inputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits = ['', '', '', '', '', ''];
  private lastCompleted = '';

  ngAfterViewInit(): void { queueMicrotask(() => this.focus(0)); }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const incoming = input.value.replace(/\D/g, '');
    if (!incoming) {
      this.digits[index] = '';
      this.emitValue();
      return;
    }
    this.applyDigits(index, incoming);
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      event.preventDefault();
      this.digits[index - 1] = '';
      this.emitValue();
      this.focus(index - 1);
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); this.focus(index - 1); }
    if (event.key === 'ArrowRight' && index < 5) { event.preventDefault(); this.focus(index + 1); }
  }

  onPaste(event: ClipboardEvent): void {
    const digits = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (!digits) return;
    event.preventDefault();
    this.setDigits(digits);
    this.emitValue();
    this.focus(Math.min(digits.length, 6) - 1);
  }

  selectInput(event: FocusEvent): void { (event.target as HTMLInputElement).select(); }

  private applyDigits(start: number, value: string): void {
    for (const [offset, digit] of [...value].entries()) {
      if (start + offset >= 6) break;
      this.digits[start + offset] = digit;
    }
    this.emitValue();
    this.focus(Math.min(start + value.length, 5));
  }

  private setDigits(value: string): void {
    const normalized = (value ?? '').replace(/\D/g, '').slice(0, 6);
    this.digits = Array.from({ length: 6 }, (_, index) => normalized[index] ?? '');
    if (normalized.length < 6) this.lastCompleted = '';
  }

  private emitValue(): void {
    const code = this.digits.join('');
    this.valueChange.emit(code);
    if (code.length === 6 && code !== this.lastCompleted) {
      this.lastCompleted = code;
      this.completed.emit(code);
    } else if (code.length < 6) {
      this.lastCompleted = '';
    }
  }

  private focus(index: number): void { this.inputs?.get(index)?.nativeElement.focus(); }
}
