import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '../core/i18n.service';

export interface TurnstileState {
  loading: boolean;
  required: boolean;
  error: boolean;
}

@Component({
  selector: 'app-turnstile-widget',
  standalone: true,
  template: `
    <div #container class="turnstile-container"></div>
    @if (state.error) {
      <div class="notice warning" role="alert">
        {{ i18n.text('serviceUnavailable') }}
        <button type="button" class="button secondary compact" (click)="retry()">{{ i18n.text('retryVerification') }}</button>
      </div>
    }
  `,
  styles: [`.turnstile-container{display:flex;width:100%;min-height:0;justify-content:center}`],
})
export class TurnstileWidgetComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) action = '';
  @Output() tokenChange = new EventEmitter<string>();
  @Output() stateChange = new EventEmitter<TurnstileState>();
  @ViewChild('container') container?: ElementRef<HTMLElement>;

  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private widgetId?: string;
  private destroyed = false;
  state: TurnstileState = { loading: true, required: false, error: false };

  constructor(readonly i18n: I18nService) {}

  async ngAfterViewInit(): Promise<void> { await this.load(); }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId) (window as TurnstileWindow).turnstile?.remove(this.widgetId);
  }

  reset(): void {
    this.tokenChange.emit('');
    if (this.widgetId) (window as TurnstileWindow).turnstile?.reset(this.widgetId);
  }

  retry(): void {
    this.setState({ loading: true, required: this.state.required, error: false });
    this.tokenChange.emit('');
    if (this.widgetId) (window as TurnstileWindow).turnstile?.reset(this.widgetId);
    else void this.load();
  }

  private async load(): Promise<void> {
    if (!this.browser || this.destroyed) return;
    try {
      const config = await firstValueFrom(this.http.get<{ site_key: string; required: boolean }>('/auth/turnstile/config'));
      if (this.destroyed) return;
      this.setState({ loading: true, required: config.required, error: false });
      if (config.required && !config.site_key) throw new Error('Turnstile is not configured');
      if (config.site_key) this.render(config.site_key);
      else this.setState({ loading: false, required: false, error: false });
    } catch {
      if (!this.destroyed) this.setState({ loading: false, required: this.state.required, error: true });
    }
  }

  private render(siteKey: string): void {
    const renderWidget = () => {
      if (this.destroyed || !this.container || !(window as TurnstileWindow).turnstile) return;
      this.widgetId = (window as TurnstileWindow).turnstile!.render(this.container.nativeElement, {
        sitekey: siteKey,
        action: this.action,
        theme: 'light',
        appearance: 'always',
        size: 'flexible',
        callback: token => this.zone.run(() => this.tokenChange.emit(token)),
        'expired-callback': () => this.zone.run(() => this.tokenChange.emit('')),
        'error-callback': () => this.zone.run(() => {
          this.tokenChange.emit('');
          this.setState({ loading: false, required: this.state.required, error: true });
        }),
      });
      this.setState({ loading: false, required: this.state.required, error: false });
    };
    if ((window as TurnstileWindow).turnstile) { renderWidget(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', renderWidget, { once: true });
    script.addEventListener('error', () => {
      script.remove();
      this.setState({ loading: false, required: this.state.required, error: true });
    }, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      document.head.appendChild(script);
    }
  }

  private setState(state: TurnstileState): void {
    this.state = state;
    this.stateChange.emit(state);
  }
}

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (element: HTMLElement, options: {
      sitekey: string;
      action: string;
      theme: string;
      appearance: string;
      size: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    }) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
  };
}
