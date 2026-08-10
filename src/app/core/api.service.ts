import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string) { return this.http.get<T>(path); }
  getArrayBuffer(path: string) { return this.http.get(path, { responseType: 'arraybuffer' }); }
  getBlob(path: string) { return this.http.get(path, { responseType: 'blob', observe: 'response' }); }
  post<T>(path: string, body: unknown) { return this.http.post<T>(path, body); }
  delete(path: string) { return this.http.delete(path); }

  postFile<T>(path: string, file: File, parameters: Record<string, string>) {
    const params = new HttpParams({ fromObject: parameters });
    const headers = new HttpHeaders({ 'Content-Type': file.type || 'application/octet-stream' });
    return this.http.post<T>(path, file, { headers, params });
  }
}
