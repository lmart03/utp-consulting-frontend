import { HttpInterceptorFn } from '@angular/common/http';

/** Envía la cookie de sesión (JSESSIONID) en las llamadas al backend, también si se usa sin proxy. */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
