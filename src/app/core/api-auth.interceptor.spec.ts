import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiAuthInterceptor, getAccessToken, setAccessToken } from './api-auth.interceptor';

describe('apiAuthInterceptor', () => {
  let client: HttpClient;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiAuthInterceptor])), provideHttpClientTesting()],
    });
    client = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    setAccessToken(null);
  });

  afterEach(() => {
    requests.verify();
    setAccessToken(null);
  });

  it('keeps the access token in memory and sends it as Bearer', () => {
    setAccessToken('access-secret');
    client.get('/documents').subscribe();
    const request = requests.expectOne('/documents');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-secret');
    expect(sessionStorage.getItem('rubrica.access-token')).toBeNull();
    request.flush([]);
  });

  it('shares one refresh and retries requests with the new token', () => {
    setAccessToken('expired');
    const received: unknown[] = [];
    client.get('/documents').subscribe(value => received.push(value));
    client.get('/tenants').subscribe(value => received.push(value));
    requests.expectOne('/documents').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/tenants').flush({}, { status: 401, statusText: 'Unauthorized' });

    requests.expectOne('/auth/refresh').flush({ access_token: 'renewed' });
    const documents = requests.expectOne('/documents');
    const tenants = requests.expectOne('/tenants');
    expect(documents.request.headers.get('Authorization')).toBe('Bearer renewed');
    expect(tenants.request.headers.get('Authorization')).toBe('Bearer renewed');
    documents.flush([]);
    tenants.flush([]);
    expect(received).toEqual([[], []]);
    expect(getAccessToken()).toBe('renewed');
  });
});
