import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface RubricaSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-rubrica-select',
  standalone: true,
  template: `
    <details class="rubrica-select" #menu [class.disabled]="disabled" (toggle)="disabled && menu.removeAttribute('open')">
      <summary [attr.aria-label]="ariaLabel" [attr.aria-disabled]="disabled">
        <span>{{ selectedLabel() }}</span><i class="bi bi-chevron-down" aria-hidden="true"></i>
      </summary>
      <div class="rubrica-select-options" role="listbox" [attr.aria-label]="ariaLabel">
        @for (option of options; track option.value) {
          <button type="button" role="option" [disabled]="option.disabled" [class.active]="option.value === value"
            [attr.aria-selected]="option.value === value" (click)="choose(option.value, menu)">
            <span>{{ option.label }}</span>@if (option.value === value) { <i class="bi bi-check2" aria-hidden="true"></i> }
          </button>
        }
      </div>
    </details>
  `,
})
export class RubricaSelectComponent {
  @Input() options: RubricaSelectOption[] = [];
  @Input() value = '';
  @Input() disabled = false;
  @Input() ariaLabel = '';
  @Output() readonly valueChange = new EventEmitter<string>();

  selectedLabel(): string { return this.options.find(option => option.value === this.value)?.label ?? ''; }
  choose(value: string, menu: HTMLDetailsElement): void {
    if (this.disabled) return;
    this.valueChange.emit(value);
    menu.removeAttribute('open');
  }
}
