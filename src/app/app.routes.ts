import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ExamsComponent } from './features/exams/exams.component';
import { ExamPlayerComponent } from './features/exams/exam-player.component';
import { ResultComponent } from './features/exams/result.component';
import { MistakesComponent } from './features/mistakes/mistakes.component';
import { AdminImportComponent } from './features/admin/admin-import.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'oficiales', component: ExamsComponent },
      { path: 'oficiales/:id', component: ExamPlayerComponent },
      { path: 'resultado/:id', component: ResultComponent },
      { path: 'falladas', component: MistakesComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  {
    path: 'admin',
    component: AppShellComponent,
    canActivate: [authGuard, adminGuard],
    children: [
      { path: 'importar', component: AdminImportComponent },
      { path: '', pathMatch: 'full', redirectTo: 'importar' }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: '**', redirectTo: 'app/dashboard' }
];
