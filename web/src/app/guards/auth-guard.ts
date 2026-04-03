import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Comprobamos si existe el token en el localStorage
  const token = localStorage.getItem('token');
  
  if (token) {
    return true; // Si hay token, le dejamos pasar
  } else {
    // Si no hay token, lo mandamos al login
    router.navigate(['/login']);
    return false;
  }
};
