import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private apiUrl = `${environment.apiUrl}/tenants`; // Tu backend

  constructor(private http: HttpClient) {}

  // 1. Obtener lista de todos los agentes
  getTenants(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // 2. Crear un nuevo agente
  createTenant(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  // 👉 NUEVA FUNCIÓN PARA EDITAR
  updateTenant(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, data);
  }

  getAvailableTools(niche?: string): Observable<any[]> {
    const url = niche ? `${environment.apiUrl}/tools?niche=${niche}` : `${environment.apiUrl}/tools`;
    return this.http.get<any[]>(url);
  }

  updateAccount(id: string, payload: { email?: string; currentPassword?: string; newPassword?: string }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/account`, payload);
  }
}