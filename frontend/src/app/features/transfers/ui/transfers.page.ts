import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-transfers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Transferencias</h1>',
})
export class TransfersPage {}
