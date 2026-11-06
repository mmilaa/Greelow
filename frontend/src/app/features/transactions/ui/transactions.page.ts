import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Movimientos</h1>',
})
export class TransactionsPage {}
