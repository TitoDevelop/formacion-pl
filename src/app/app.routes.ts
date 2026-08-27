import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { LoginComponent } from './features/auth/login.component';
import { NoAccessComponent } from './features/auth/no-access.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ExamPlayerComponent } from './features/exams/exam-player.component';
import { ResultComponent } from './features/exams/result.component';
import { CustomTestComponent } from './features/exams/custom-test.component';
import { TestsLibraryComponent } from './features/exams/tests-library.component';
import { TestPlayerComponent } from './features/exams/test-player.component';
import { MistakesComponent } from './features/mistakes/mistakes.component';
import { ReviewTestComponent } from './features/mistakes/review-test.component';
import { AdminImportComponent } from './features/admin/admin-import.component';
import { AdminStudentsComponent } from './features/admin/admin-students.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'sin-acceso', component: NoAccessComponent },

  {
    path: 'app',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'crear-test', component: CustomTestComponent },
      { path: 'tests', component: TestsLibraryComponent },
      { path: 'test/personalizado', component: TestPlayerComponent, data: { source: 'CUSTOM' } },
      { path: 'test/repaso', component: TestPlayerComponent, data: { source: 'REVIEW' } },
      { path: 'oficiales/:id', component: ExamPlayerComponent },
      { path: 'resultado/:id', component: ResultComponent },
      { path: 'repasar', component: ReviewTestComponent },
      { path: 'falladas', component: MistakesComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },

  {
    path: 'admin',
    component: AppShellComponent,
    canActivate: [authGuard, adminGuard],
    children: [
      { path: 'alumnos', component: AdminStudentsComponent },
      { path: 'importar', component: AdminImportComponent },
      { path: '', pathMatch: 'full', redirectTo: 'alumnos' }
    ]
  },

  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: '**', redirectTo: 'app/dashboard' }
];
