import { BillingPageComponent } from './billing-page.component';

describe('subscription actions', () => {
  const stripeAccount = { status: 'active', provider_customer_id: 'cus_test', provider_subscription_id: 'sub_test' };

  it.each([
    ['active Stripe subscription', stripeAccount, true, false],
    ['cancellation scheduled', { ...stripeAccount, cancel_at_period_end: true }, true, false],
    ['paid seed fixture', { status: 'active' }, false, true],
    ['missing Stripe customer', { status: 'active', provider_subscription_id: 'sub_test' }, false, false],
    ['cancelled subscription', { ...stripeAccount, status: 'cancelled' }, true, true],
    ['lifetime account', { ...stripeAccount, complimentary_lifetime: true }, false, false],
  ] as const)('%s has distinct management and checkout actions', (_label, account, portal, checkout) => {
    const state = {
      account: () => account,
      planSelectable: () => true,
    } as unknown as BillingPageComponent;

    expect(BillingPageComponent.prototype.showPortalAction.call(state)).toBe(portal);
    expect(BillingPageComponent.prototype.canSubscribe.call(state)).toBe(checkout);
  });
});
