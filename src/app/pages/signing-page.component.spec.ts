import { SigningPageComponent } from './signing-page.component';

describe('signing identity selection', () => {
  const passport = { id: 'passport', identifier_type: 'PASSPORT', issuing_country: 'JP' };
  const cpf = { id: 'cpf', identifier_type: 'BR_CPF', issuing_country: 'BR' };

  it.each([
    ['evidence', passport, true],
    ['evidence', cpf, true],
    ['serpro_timestamp', passport, false],
    ['serpro_timestamp', cpf, true],
    ['serproid', passport, false],
    ['serproid', cpf, true],
  ] as const)('applies the document rules for %s with %j', (mode, selected, expected) => {
    const state = {
      identifiers: () => [passport, cpf],
      selectedIdentifier: () => selected.id,
      signatureMode: () => mode,
      context: () => ({ signer: { identity_document_type: 'BR_CPF' } }),
    } as unknown as SigningPageComponent;

    expect(SigningPageComponent.prototype.identityEligible.call(state)).toBe(expected);
  });

  it('blocks an evidence signature without an eligible identity', () => {
    const state = {
      identifiers: () => [],
      selectedIdentifier: () => '',
      signatureMode: () => 'evidence',
      context: () => ({ signer: {} }),
    } as unknown as SigningPageComponent;

    expect(SigningPageComponent.prototype.identityEligible.call(state)).toBe(false);
  });

  it.each([
    [false, false, 'JP'],
    [true, false, 'BR'],
    [false, true, 'BR'],
  ])('preserves the recorded country for completed or administrative views', (completed, administrator, country) => {
    const state = {
      identifiers: () => [passport, cpf],
      selectedIdentifier: () => passport.id,
      context: () => ({ signer: { identity_document_country: 'BR' }, account_country: 'US' }),
      completed: () => completed,
      administrativeView: () => administrator,
    } as unknown as SigningPageComponent;

    expect(SigningPageComponent.prototype.signerCountry.call(state)).toBe(country);
  });
});
