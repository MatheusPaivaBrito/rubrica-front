import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rubrica-color-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <details class="rubrica-color-picker" #picker>
      <summary [attr.aria-label]="ariaLabel">
        <span class="rubrica-color-swatch" [style.background]="normalizedValue"></span>
        <span><strong>{{ normalizedValue }}</strong><small>Toque na amostra para alterar</small></span>
        <i class="bi bi-chevron-down" aria-hidden="true"></i>
      </summary>
      <section class="rubrica-color-popover">
        <div
          class="rubrica-color-map"
          [style.background-color]="hueColor()"
          (pointerdown)="pickFromMap($event)"
          (pointermove)="$event.buttons && pickFromMap($event)"
        >
          <span class="rubrica-color-map-thumb" [style.left.%]="saturation" [style.top.%]="100 - brightness"></span>
        </div>
        <div class="rubrica-hue-row">
          <i class="bi bi-eyedropper" aria-hidden="true"></i>
          <span class="rubrica-current-color" [style.background]="normalizedValue"></span>
          <input class="rubrica-hue-slider" type="range" min="0" max="360" [ngModel]="hue" (ngModelChange)="setHue($event)" aria-label="Matiz" />
        </div>
        <header><span class="rubrica-color-preview" [style.background]="normalizedValue"></span><label>Hexadecimal<input maxlength="7" autocomplete="off" spellcheck="false" [ngModel]="normalizedValue" (ngModelChange)="setHex($event)" /></label></header>
        <div class="rubrica-rgb-fields">
          <label><span>R</span><input type="number" inputmode="numeric" min="0" max="255" [ngModel]="red" (ngModelChange)="setChannel('red', $event)" /></label>
          <label><span>G</span><input type="number" inputmode="numeric" min="0" max="255" [ngModel]="green" (ngModelChange)="setChannel('green', $event)" /></label>
          <label><span>B</span><input type="number" inputmode="numeric" min="0" max="255" [ngModel]="blue" (ngModelChange)="setChannel('blue', $event)" /></label>
        </div>
        <footer><span>RGB {{ red }}, {{ green }}, {{ blue }}</span><button type="button" (click)="picker.removeAttribute('open')">Concluir</button></footer>
      </section>
    </details>
  `,
})
export class RubricaColorPickerComponent implements OnChanges {
  @Input() value = '#187A66';
  @Input() ariaLabel = 'Cor';
  @Output() readonly valueChange = new EventEmitter<string>();

  normalizedValue = '#187A66';
  red = 24;
  green = 122;
  blue = 102;
  hue = 166;
  saturation = 80;
  brightness = 48;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) this.applyHex(this.value, false);
  }

  setHex(value: string): void {
    const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
    if (/^#[0-9a-f]{6}$/i.test(candidate)) this.applyHex(candidate, true);
  }

  setChannel(channel: 'red' | 'green' | 'blue', value: number | string): void {
    this[channel] = Math.min(255, Math.max(0, Number(value) || 0));
    this.syncHexAndHsv();
  }

  setHue(value: number | string): void { this.hue = Number(value); this.applyHsv(); }
  hueColor(): string { return `hsl(${this.hue} 100% 50%)`; }

  pickFromMap(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    this.saturation = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    this.brightness = Math.min(100, Math.max(0, (1 - (event.clientY - bounds.top) / bounds.height) * 100));
    target.setPointerCapture?.(event.pointerId);
    this.applyHsv();
  }

  private applyHex(value: string, emit: boolean): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    this.normalizedValue = value.toUpperCase();
    this.red = Number.parseInt(this.normalizedValue.slice(1, 3), 16);
    this.green = Number.parseInt(this.normalizedValue.slice(3, 5), 16);
    this.blue = Number.parseInt(this.normalizedValue.slice(5, 7), 16);
    const hsv = this.rgbToHsv(this.red, this.green, this.blue);
    this.hue = hsv.h;
    this.saturation = hsv.s;
    this.brightness = hsv.v;
    if (emit) this.valueChange.emit(this.normalizedValue);
  }

  private applyHsv(): void {
    const rgb = this.hsvToRgb(this.hue, this.saturation, this.brightness);
    this.red = rgb.r; this.green = rgb.g; this.blue = rgb.b;
    this.syncHex();
  }

  private syncHexAndHsv(): void {
    this.syncHex();
    const hsv = this.rgbToHsv(this.red, this.green, this.blue);
    this.hue = hsv.h; this.saturation = hsv.s; this.brightness = hsv.v;
  }

  private syncHex(): void {
    this.normalizedValue = `#${[this.red, this.green, this.blue].map(item => Math.round(item).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    this.valueChange.emit(this.normalizedValue);
  }

  private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const saturation = s / 100; const brightness = v / 100;
    const chroma = brightness * saturation; const segment = h / 60; const x = chroma * (1 - Math.abs(segment % 2 - 1));
    const [r1, g1, b1] = segment < 1 ? [chroma, x, 0] : segment < 2 ? [x, chroma, 0] : segment < 3 ? [0, chroma, x] : segment < 4 ? [0, x, chroma] : segment < 5 ? [x, 0, chroma] : [chroma, 0, x];
    const m = brightness - chroma;
    return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
  }

  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    const red = r / 255; const green = g / 255; const blue = b / 255;
    const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
    let h = 0;
    if (delta) h = max === red ? 60 * (((green - blue) / delta) % 6) : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4);
    return { h: Math.round((h + 360) % 360), s: max ? (delta / max) * 100 : 0, v: max * 100 };
  }
}
