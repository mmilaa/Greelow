import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { authGuard, loginGuard } from './features/auth/infrastructure/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Ingresar',
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
        title: 'Cuentas',
        loadComponent: () =>
          import('./features/accounts/ui/accounts.page').then((m) => m.AccountsPage),
      },
      {
        // No static title: the detail component sets the tab title to the
        // account name (and "Cuenta" until it resolves).
        path: 'accounts/:id',
        loadComponent: () =>
          import('./features/accounts/ui/account-detail.page').then((m) => m.AccountDetailPage),
      },
      {
        path: 'transactions',
        title: 'Movimientos',
        loadComponent: () =>
          import('./features/transactions/ui/transactions.page').then((m) => m.TransactionsPage),
      },
      {
        path: 'transfers',
        title: 'Transferencias',
        loadComponent: () =>
          import('./features/transfers/ui/transfers.page').then((m) => m.TransfersPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'accounts' },
    ],
  },
  { path: '**', redirectTo: 'accounts' },
];
