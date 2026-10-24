import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RubricaColorPickerComponent } from './rubrica-color-picker.component';

describe('RubricaColorPickerComponent', () => {
  let fixture: ComponentFixture<RubricaColorPickerComponent>;
  let component: RubricaColorPickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RubricaColorPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(RubricaColorPickerComponent);
    component = fixture.componentInstance;
  });

  it('converts a hexadecimal value into RGB channels', () => {
    component.value = '#00ffcc';
    component.ngOnChanges({ value: { currentValue: '#00ffcc', previousValue: '', firstChange: true, isFirstChange: () => true } });
    expect([component.red, component.green, component.blue]).toEqual([0, 255, 204]);
    expect(component.normalizedValue).toBe('#00FFCC');
  });

  it('emits a hexadecimal value when an RGB channel changes', () => {
    const emitted: string[] = [];
    component.valueChange.subscribe(value => emitted.push(value));
    component.setChannel('red', 168);
    component.setChannel('green', 32);
    component.setChannel('blue', 53);
    expect(emitted.at(-1)).toBe('#A82035');
  });
});
