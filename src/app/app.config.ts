import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { apiAuthInterceptor } from './core/api-auth.interceptor';
import { provideClientHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { PwaUpdateService } from './core/pwa-update.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiAuthInterceptor])),
    provideClientHydration(),
    provideEnvironmentNgxMask({ dropSpecialCharacters: false }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:5000',
    }),
    provideAppInitializer(() => inject(PwaUpdateService).start()),
  ],
};
