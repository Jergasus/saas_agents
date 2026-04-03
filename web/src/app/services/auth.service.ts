import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  register(data: { name: string, email: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  login(data: { email: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data).pipe(
      // 'tap' nos permite hacer algo con la respuesta antes de devolverla
      tap((res: any) => {
        // Guardamos el token y el ID del cliente en el navegador
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('tenantId', res.tenantId);
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token'); // Devuelve true si hay token
  }
}