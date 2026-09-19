import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { PasswordFieldComponent } from './password-field.component';


describe('PasswordFieldComponent', () => {
  let fixture: ComponentFixture<PasswordFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PasswordFieldComponent] }).compileComponents();
    fixture = TestBed.createComponent(PasswordFieldComponent);
    fixture.componentRef.setInput('label', 'Password');
    fixture.detectChanges();
  });

  it('keeps the value hidden until the visibility button is pressed', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const toggle = fixture.nativeElement.querySelector('.password-toggle') as HTMLButtonElement;

    expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });

  it('propagates typed values through the form control contract', () => {
    const changed = vi.fn();
    fixture.componentInstance.registerOnChange(changed);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'Secure#2026';
    input.dispatchEvent(new Event('input'));

    expect(changed).toHaveBeenCalledWith('Secure#2026');
  });
});
