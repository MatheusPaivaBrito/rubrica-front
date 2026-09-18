import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string) { return this.http.get<T>(path); }
  getArrayBuffer(path: string) { return this.http.get(path, { responseType: 'arraybuffer' }); }
  getBlob(path: string) { return this.http.get(path, { responseType: 'blob', observe: 'response' }); }
  post<T>(path: string, body: unknown) { return this.http.post<T>(path, body); }
  patch<T>(path: string, body: unknown) { return this.http.patch<T>(path, body); }
  delete(path: string) { return this.http.delete(path); }
  deleteWithBody<T>(path: string, body: unknown) { return this.http.delete<T>(path, { body }); }

  postFile<T>(path: string, content: ArrayBuffer, contentType: string, parameters: Record<string, string>) {
    const params = new HttpParams({ fromObject: parameters });
    const headers = new HttpHeaders({ 'Content-Type': contentType || 'application/octet-stream' });
    return this.http.post<T>(path, content, { headers, params });
  }
}
