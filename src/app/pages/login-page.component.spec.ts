import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth.service';
import { FeedbackService } from '../core/feedback.service';
import { I18nService } from '../core/i18n.service';
import { LoginPageComponent } from './login-page.component';

describe('login return destination', () => {
  it.each([
    ['https://outside.example.test/collect', '/dashboard'],
    ['//outside.example.test/collect', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['\\\\outside.example.test\\collect', '/dashboard'],
    ['/signing/synthetic-link', '/signing/synthetic-link'],
  ])('navigates internally for %s', async (returnUrl, expected) => {
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const signedIn = vi.fn().mockResolvedValue({ access_token: 'synthetic-session' });
    const auth = {
      login: signedIn,
      context: () => ({ mfa_setup_required: false }),
      dashboardUrl: () => Promise.resolve('/dashboard'),
    } as unknown as AuthService;
    const router = { navigateByUrl } as unknown as Router;
    const route = { snapshot: { queryParamMap: convertToParamMap({ returnUrl }) } } as ActivatedRoute;
    const page = new LoginPageComponent(auth, router, route, {} as FeedbackService, {} as I18nService);
    page.verificationLoading.set(false);
    page.email = 'synthetic@example.test';
    page.password = 'Synthetic-9';

    await page.submit();

    expect(signedIn).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith(expected);
  });
});
