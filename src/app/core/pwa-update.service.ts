import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import Swal from 'sweetalert2';
import { I18nService, Locale } from './i18n.service';

export interface ReleaseNotes {
  schemaVersion: 1;
  releaseId: string;
  releasedAt: string;
  highlights: string[];
}

interface ReleaseAppData {
  schema_version?: unknown;
  release_id?: unknown;
  released_at?: unknown;
  highlights?: unknown;
}

export function parseReleaseNotes(value: unknown, locale: Locale): ReleaseNotes | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as ReleaseAppData;
  if (data.schema_version !== 1 || typeof data.release_id !== 'string' || !data.release_id.trim() || data.release_id.length > 80) return null;
  if (typeof data.released_at !== 'string' || Number.isNaN(Date.parse(data.released_at))) return null;
  if (!data.highlights || typeof data.highlights !== 'object' || Array.isArray(data.highlights)) return null;
  const localized = data.highlights as Record<string, unknown>;
  const candidate = localized[locale] ?? localized['en'] ?? localized['pt-BR'];
  if (!Array.isArray(candidate)) return null;
  const highlights = candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 240).map(item => item.trim()).slice(0, 6);
  if (!highlights.length) return null;
  return { schemaVersion: 1, releaseId: data.release_id.trim(), releasedAt: data.released_at, highlights };
}

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private modalOpen = false;

  constructor(private readonly updates: SwUpdate, private readonly i18n: I18nService) {}

  start(): void {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe((event) => void this.offerUpdate(event));
    void this.updates.checkForUpdate();
  }

  private async offerUpdate(event: VersionReadyEvent): Promise<void> {
    const notes = parseReleaseNotes(event.latestVersion.appData, this.i18n.locale());
    const releaseKey = notes?.releaseId ?? event.latestVersion.hash;
    const storageKey = `rubrica:update-dismissed:${releaseKey}`;
    if (this.modalOpen || this.wasDismissed(storageKey)) return;
    this.modalOpen = true;
    try {
      const result = await Swal.fire({
        icon: 'info',
        title: this.i18n.text('updateAvailable'),
        text: notes ? `${this.whatsNewLabel()}\n\n${notes.highlights.map(item => `• ${item}`).join('\n')}` : this.i18n.text('updateHelp'),
        customClass: { htmlContainer: 'release-notes' },
        confirmButtonText: this.i18n.text('updateNow'),
        showCancelButton: true,
        cancelButtonText: this.i18n.text('later'),
        confirmButtonColor: '#a82035',
      });
      if (!result.isConfirmed) {
        this.dismissForSession(storageKey);
        return;
      }
      await this.updates.activateUpdate();
      document.location.reload();
    } finally {
      this.modalOpen = false;
    }
  }

  private whatsNewLabel(): string {
    return ({ 'pt-BR': 'O que há de novo', en: "What's new", es: 'Novedades', 'ja-JP': '新機能' } as Record<Locale, string>)[this.i18n.locale()];
  }

  private wasDismissed(key: string): boolean {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  }

  private dismissForSession(key: string): void {
    try { sessionStorage.setItem(key, '1'); } catch { /* Storage may be unavailable in privacy modes. */ }
  }
}
