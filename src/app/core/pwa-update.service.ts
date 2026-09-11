import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import Swal from 'sweetalert2';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  constructor(private readonly updates: SwUpdate, private readonly i18n: I18nService) {}

  start(): void {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => void this.offerUpdate());
    void this.updates.checkForUpdate();
  }

  private async offerUpdate(): Promise<void> {
    const result = await Swal.fire({
      icon: 'info',
      title: this.i18n.text('updateAvailable'),
      text: this.i18n.text('updateHelp'),
      confirmButtonText: this.i18n.text('updateNow'),
      showCancelButton: true,
      cancelButtonText: this.i18n.text('later'),
      confirmButtonColor: '#187a66',
    });
    if (!result.isConfirmed) return;
    await this.updates.activateUpdate();
    document.location.reload();
  }
}
