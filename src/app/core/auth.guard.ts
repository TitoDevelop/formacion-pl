import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) await auth.init();

  if (!auth.user()) return router.createUrlTree(['/login']);
  if (!auth.hasAccess()) return router.createUrlTree(['/sin-acceso']);
  return true;
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) await auth.init();

  return auth.user() && auth.isAdmin()
    ? true
    : router.createUrlTree(['/app/dashboard']);
};
