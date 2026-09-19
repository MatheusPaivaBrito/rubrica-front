import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OneTimeCodeComponent } from './one-time-code.component';

describe('OneTimeCodeComponent', () => {
  let fixture: ComponentFixture<OneTimeCodeComponent>;
  let inputs: HTMLInputElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OneTimeCodeComponent] }).compileComponents();
    fixture = TestBed.createComponent(OneTimeCodeComponent);
    fixture.detectChanges();
    inputs = Array.from(fixture.nativeElement.querySelectorAll('input'));
  });

  it('advances while typing and emits the completed six-digit code', () => {
    const completed: string[] = [];
    fixture.componentInstance.completed.subscribe(value => completed.push(value));

    for (const [index, digit] of [...'123456'].entries()) {
      inputs[index].value = digit;
      inputs[index].dispatchEvent(new Event('input'));
    }

    expect(fixture.componentInstance.digits.join('')).toBe('123456');
    expect(completed).toEqual(['123456']);
  });

  it('distributes a pasted code and ignores non-digits', () => {
    const completed: string[] = [];
    fixture.componentInstance.completed.subscribe(value => completed.push(value));
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => '12 34-56' } });

    inputs[0].dispatchEvent(event);

    expect(fixture.componentInstance.digits).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(completed).toEqual(['123456']);
  });

  it('moves back to the previous position on an empty backspace', () => {
    inputs[0].value = '7';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].focus();
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));

    expect(fixture.componentInstance.digits[0]).toBe('');
    expect(document.activeElement).toBe(inputs[0]);
  });
});
