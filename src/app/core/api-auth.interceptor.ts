import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

const accessTokenKey = 'rubrica.access-token';
interface RefreshResponse { access_token: string; }
let refreshRequest$: Observable<RefreshResponse> | null = null;

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const http = inject(HttpClient);
  const token = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(accessTokenKey);
  const headers = token ? request.headers.set('Authorization', `Bearer ${token}`) : request.headers;
  const authenticatedRequest = request.clone({ headers, withCredentials: true });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || request.url.includes('/auth/refresh') || request.url.includes('/auth/login') || request.url.includes('/auth/mfa/challenge')) {
        return throwError(() => error);
      }
      if (!refreshRequest$) {
        refreshRequest$ = http.post<RefreshResponse>('/auth/refresh', {}, { withCredentials: true }).pipe(
          shareReplay({ bufferSize: 1, refCount: false }),
          finalize(() => { refreshRequest$ = null; }),
        );
      }
      return refreshRequest$.pipe(
        switchMap((response) => {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(accessTokenKey, response.access_token);
          return next(request.clone({
            headers: request.headers.set('Authorization', `Bearer ${response.access_token}`),
            withCredentials: true,
          }));
        }),
        catchError((refreshError) => {
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(accessTokenKey);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

export { accessTokenKey };
