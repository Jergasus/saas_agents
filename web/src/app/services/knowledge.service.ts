import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class KnowledgeService {
  private apiUrl = `${environment.apiUrl}/knowledge`;

  constructor(private http: HttpClient) {}

  // Enviar el texto para que Gemini lo convierta en Vector y lo guarde
  addKnowledge(tenantId: string, content: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, { tenantId, content });
  }

  getAll(tenantId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?tenantId=${tenantId}`);
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  uploadFile(tenantId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('tenantId', tenantId);
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}/upload`, formData);
  }
}