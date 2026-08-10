import { HttpInterceptorFn } from '@angular/common/http';

const accessTokenKey = 'rubrica.access-token';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem(accessTokenKey);
  const headers = token ? request.headers.set('Authorization', `Bearer ${token}`) : request.headers;
  return next(request.clone({ headers, withCredentials: true }));
};

export { accessTokenKey };
