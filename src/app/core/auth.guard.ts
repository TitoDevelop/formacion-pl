import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) await auth.init();
  return auth.user() ? true : router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.initialized()) await auth.init();
  return auth.user() && auth.isAdmin()
    ? true
    : router.createUrlTree(['/app/dashboard']);
};
