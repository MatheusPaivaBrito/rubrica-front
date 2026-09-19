import { booleanAttribute, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { I18nService } from '../core/i18n.service';

@Component({
  selector: 'app-password-field',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordFieldComponent), multi: true }],
  template: `
    <label>
      {{ label }}
      <span class="password-field">
        <input
          [type]="visible ? 'text' : 'password'"
          [value]="value"
          [attr.autocomplete]="autocomplete"
          [attr.minlength]="minlength"
          [attr.maxlength]="maxlength"
          [attr.pattern]="pattern || null"
          [required]="required"
          [disabled]="disabled"
          (input)="update($event)"
          (blur)="touched()"
        />
        <button
          type="button"
          class="password-toggle"
          [attr.aria-label]="i18n.text(visible ? 'hidePassword' : 'showPassword')"
          [attr.title]="i18n.text(visible ? 'hidePassword' : 'showPassword')"
          (click)="visible = !visible"
        ><i class="bi" [class.bi-eye]="!visible" [class.bi-eye-slash]="visible" aria-hidden="true"></i></button>
      </span>
    </label>
  `,
})
export class PasswordFieldComponent implements ControlValueAccessor {
  @Input({ required: true }) label = '';
  @Input() autocomplete = 'current-password';
  @Input() minlength: number | null = null;
  @Input() maxlength: number | null = null;
  @Input() pattern = '';
  @Input({ transform: booleanAttribute }) required = false;

  value = '';
  visible = false;
  disabled = false;
  private changed: (value: string) => void = () => undefined;
  touched: () => void = () => undefined;

  constructor(readonly i18n: I18nService) {}

  writeValue(value: string | null): void { this.value = value ?? ''; }
  registerOnChange(callback: (value: string) => void): void { this.changed = callback; }
  registerOnTouched(callback: () => void): void { this.touched = callback; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  update(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.changed(this.value);
  }
}
