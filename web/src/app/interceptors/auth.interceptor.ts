import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Obtenemos el token del localStorage
  const token = localStorage.getItem('token');

  // Si hay token, clonamos la petición y le añadimos la cabecera Authorization
  if (token) {
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedReq);
  }

  // Si no hay token, enviamos la petición tal cual
  return next(req);
};
