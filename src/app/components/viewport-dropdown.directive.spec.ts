import { describe, expect, it } from 'vitest';
import { dropdownPlacement } from './viewport-dropdown.directive';

describe('dropdown placement', () => {
  it('opens down when the menu fits below', () => {
    expect(dropdownPlacement(160, 500, 160)).toEqual({ opensUp: false, maxHeight: 160 });
  });

  it('flips up when the menu does not fit below and there is more room above', () => {
    expect(dropdownPlacement(200, 350, 90)).toEqual({ opensUp: true, maxHeight: 350 });
  });

  it('uses the larger space when neither side fits the full menu', () => {
    expect(dropdownPlacement(250, 85, 120)).toEqual({ opensUp: false, maxHeight: 120 });
  });
});
