import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '@core/services/auth.service';

/** El dashboard requiere sesión Google: sin ella la automatización no puede leer Gmail. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return auth.loadCurrentUser().pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};
