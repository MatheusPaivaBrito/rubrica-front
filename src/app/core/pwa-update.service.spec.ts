import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { TestBed } from '@angular/core/testing';
import type { SweetAlertResult } from 'sweetalert2';
import Swal from 'sweetalert2';
import { I18nService } from './i18n.service';
import { parseReleaseNotes, PwaUpdateService } from './pwa-update.service';

describe('parseReleaseNotes', () => {
  const appData = {
    schema_version: 1,
    release_id: '2026.10.16.1',
    released_at: '2026-10-16T03:28:29Z',
    highlights: {
      'pt-BR': ['Novidade em português'],
      en: ['English highlight'],
      es: ['Novedad en español'],
      'ja-JP': ['日本語の新機能'],
    },
  };

  it.each([
    ['pt-BR', 'Novidade em português'],
    ['en', 'English highlight'],
    ['es', 'Novedad en español'],
    ['ja-JP', '日本語の新機能'],
  ] as const)('selects highlights for %s', (locale, expected) => {
    expect(parseReleaseNotes(appData, locale)?.highlights).toEqual([expected]);
  });

  it('falls back to English when the requested locale is missing', () => {
    const withoutSpanish = { ...appData, highlights: { en: ['Fallback'] } };
    expect(parseReleaseNotes(withoutSpanish, 'es')?.highlights).toEqual(['Fallback']);
  });

  it.each([
    null,
    {},
    { ...appData, schema_version: 2 },
    { ...appData, released_at: 'not-a-date' },
    { ...appData, highlights: { en: [] } },
  ])('rejects invalid release metadata', (value) => {
    expect(parseReleaseNotes(value, 'en')).toBeNull();
  });

  it('keeps release text as plain data, including markup-looking content', () => {
    const unsafeLooking = { ...appData, highlights: { en: ['<img src=x onerror=alert(1)>'] } };
    expect(parseReleaseNotes(unsafeLooking, 'en')?.highlights).toEqual(['<img src=x onerror=alert(1)>']);
  });
});

describe('PwaUpdateService', () => {
  const event: VersionReadyEvent = {
    type: 'VERSION_READY',
    currentVersion: { hash: 'old' },
    latestVersion: {
      hash: 'new',
      appData: {
        schema_version: 1,
        release_id: 'release-test',
        released_at: '2026-10-16T03:28:29Z',
        highlights: { en: ['A safe release note'] },
      },
    },
  };

  interface TestableUpdateService { offerUpdate(value: VersionReadyEvent): Promise<void>; }

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  function service(): TestableUpdateService {
    const updates = { activateUpdate: vi.fn().mockResolvedValue(true) } as unknown as SwUpdate;
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    return new PwaUpdateService(updates, i18n) as unknown as TestableUpdateService;
  }

  it('shows localized release notes as text and suppresses a dismissed release for the session', async () => {
    const fire = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false } as SweetAlertResult);
    const updateService = service();

    await updateService.offerUpdate(event);
    await updateService.offerUpdate(event);

    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire.mock.calls[0]?.[0]).toMatchObject({ text: expect.stringContaining('A safe release note') });
  });

  it('does not open two update dialogs concurrently', async () => {
    let finish: ((value: SweetAlertResult) => void) | undefined;
    const pending = new Promise<SweetAlertResult>((resolve) => { finish = resolve; });
    const fire = vi.spyOn(Swal, 'fire').mockReturnValue(pending);
    const updateService = service();

    const first = updateService.offerUpdate(event);
    const second = updateService.offerUpdate(event);
    expect(fire).toHaveBeenCalledTimes(1);
    finish?.({ isConfirmed: false } as SweetAlertResult);
    await Promise.all([first, second]);
  });

  it('uses the generic copy when appData is invalid', async () => {
    const fire = vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: false } as SweetAlertResult);
    const updateService = service();
    await updateService.offerUpdate({ ...event, latestVersion: { hash: 'invalid', appData: {} } });
    expect(fire.mock.calls[0]?.[0]).toMatchObject({ text: 'Update now to use the latest Rubrica version.' });
  });
});
