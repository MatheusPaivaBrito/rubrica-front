import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { BillingAccount } from '../core/models';
import { BillingPageComponent } from './billing-page.component';

describe('BillingPageComponent enterprise plan', () => {
  function page(lifetime = false) {
    TestBed.configureTestingModule({ providers: [
      BillingPageComponent,
      { provide: I18nService, useValue: { locale: () => 'pt-BR', text: (key: string) => key } },
      { provide: ApiService, useValue: {} }, { provide: AuthService, useValue: {} },
      { provide: FeedbackService, useValue: {} }, { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: {} },
    ] });
    const component = TestBed.inject(BillingPageComponent);
    component.account.set({ current_product_code: 'rubrica_enterprise', status: 'active',
      complimentary_lifetime: lifetime } as BillingAccount);
    return component;
  }
  it('identifies the enterprise plan instead of showing free', () => {
    const component = page();
    expect(component.planName()).toBe('Empresarial');
    expect(component.planHelp()).toContain('API');
  });
  it('keeps the lifetime classification when an old product code remains', () => {
    const component = page(true);
    expect(component.planName()).toBe('lifetimePlan');
    expect(component.planHelp()).toBe('lifetimePlanHelp');
  });
});
