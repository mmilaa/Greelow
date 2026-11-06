import { describe, it, expect } from 'vitest';
import {
  mapTransfer,
  toCreateTransferBody,
  type TransferDto,
} from './transfer.dto';
import { type TransactionDto } from '../../../shared/infrastructure/transaction.dto';
import { Money } from '../../../shared/domain/money';
import { InvalidDataError } from '../../../shared/domain/errors';

// Fixtures copied from docs/api-samples/11 and /12 (not imported).
function leg(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: 'transfer-1-out',
    accountId: 'acc-1',
    type: 'transfer',
    direction: 'out',
    amount: 100,
    currency: 'ARS',
    category: 'transfer',
    description: 'p2p test',
    status: 'pending',
    counterpartAccountId: 'acc-4',
    transferId: 'transfer-1',
    createdAt: '2026-11-05T15:58:31.245Z',
    ...overrides,
  };
}

describe('mapTransfer', () => {
  it('maps a transfer with both legs present (sample 11, case G)', () => {
    const dto: TransferDto = {
      id: 'transfer-1',
      status: 'pending',
      from: leg({ direction: 'out' }),
      to: leg({ id: 'transfer-1-in', accountId: 'acc-4', direction: 'in', counterpartAccountId: 'acc-1' }),
    };
    const transfer = mapTransfer(dto);
    expect(transfer.id).toBe('transfer-1');
    expect(transfer.status).toBe('pending');
    expect(transfer.from?.direction).toBe('out');
    expect(transfer.to?.direction).toBe('in');
  });

  it('maps a transfer with to = null (sample 12)', () => {
    const dto: TransferDto = {
      id: 'transfer-1',
      status: 'completed',
      from: leg({ status: 'completed' }),
      to: null,
    };
    const transfer = mapTransfer(dto);
    expect(transfer.to).toBeNull();
    expect(transfer.from?.accountId).toBe('acc-1');
  });

  it('maps the inverse case with from = null (incoming transfer from another user)', () => {
    const dto: TransferDto = {
      id: 'transfer-1',
      status: 'completed',
      from: null,
      to: leg({ id: 'transfer-1-in', accountId: 'acc-4', direction: 'in', counterpartAccountId: 'acc-1' }),
    };
    const transfer = mapTransfer(dto);
    expect(transfer.from).toBeNull();
    expect(transfer.to?.direction).toBe('in');
  });

  it('throws InvalidDataError when both legs are null', () => {
    const dto: TransferDto = { id: 'transfer-1', status: 'completed', from: null, to: null };
    expect(() => mapTransfer(dto)).toThrow(InvalidDataError);
  });

  it('propagates InvalidDataError from a corrupt leg', () => {
    const dto: TransferDto = {
      id: 'transfer-1',
      status: 'pending',
      from: leg({ currency: 'BRL' }),
      to: null,
    };
    expect(() => mapTransfer(dto)).toThrow(InvalidDataError);
  });

  it('throws on a status out of the union', () => {
    const dto: TransferDto = { id: 'transfer-1', status: 'cancelled', from: leg(), to: null };
    expect(() => mapTransfer(dto)).toThrow(InvalidDataError);
  });
});

describe('toCreateTransferBody', () => {
  it('maps a command to the API body with a decimal amount', () => {
    const body = toCreateTransferBody({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: Money.fromDecimal(5000, 'ARS'),
      description: 'Pago compartido',
    });
    expect(body).toEqual({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: 5000,
      description: 'Pago compartido',
    });
  });

  it('converts minor units back to a decimal and omits description when absent', () => {
    const body = toCreateTransferBody({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: Money.fromMinor(1234, 'ARS'),
    });
    expect(body).toEqual({ fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 12.34 });
  });
});
