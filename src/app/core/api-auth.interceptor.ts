import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

let accessToken: string | null = null;
const legacyAccessTokenKey = 'rubrica.access-token';
if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(legacyAccessTokenKey);
export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(legacyAccessTokenKey);
};
interface RefreshResponse { access_token: string; }
let refreshRequest$: Observable<RefreshResponse> | null = null;

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const http = inject(HttpClient);
  const token = getAccessToken();
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
          setAccessToken(response.access_token);
          return next(request.clone({
            headers: request.headers.set('Authorization', `Bearer ${response.access_token}`),
            withCredentials: true,
          }));
        }),
        catchError((refreshError) => {
          setAccessToken(null);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
