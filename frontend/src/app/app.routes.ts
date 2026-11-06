import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { authGuard, loginGuard } from './features/auth/infrastructure/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/ui/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/ui/accounts.page').then((m) => m.AccountsPage),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/ui/transactions.page').then((m) => m.TransactionsPage),
      },
      {
        path: 'transfers',
        loadComponent: () =>
          import('./features/transfers/ui/transfers.page').then((m) => m.TransfersPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'accounts' },
    ],
  },
  { path: '**', redirectTo: 'accounts' },
];
