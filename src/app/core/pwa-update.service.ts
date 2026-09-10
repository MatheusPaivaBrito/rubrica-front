import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  constructor(private readonly updates: SwUpdate) {}

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
      title: 'Nova versão disponível',
      text: 'Atualize agora para usar a versão mais recente do Rubrica.',
      confirmButtonText: 'Atualizar',
      showCancelButton: true,
      cancelButtonText: 'Depois',
      confirmButtonColor: '#187a66',
    });
    if (!result.isConfirmed) return;
    await this.updates.activateUpdate();
    document.location.reload();
  }
}
