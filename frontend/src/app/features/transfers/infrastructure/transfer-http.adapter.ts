import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TransferPort, type CreateTransferInput } from '../application/transfer.port';
import { type Transfer } from '../domain/transfer';
import { mapTransfer, toCreateTransferBody, type TransferDto } from './transfer.dto';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiRequestRunner } from '../../../core/http/api-request-runner';

/**
 * The API wraps the transfer in a `{ transfer: {...} }` envelope on both
 * `POST /transfers` and `GET /transfers/:id` (see docs/api-samples/11, 12, 43,
 * 44, 45). The adapter must unwrap it before mapping; passing the envelope to
 * mapTransfer would leave `from`/`to` undefined and throw InvalidDataError,
 * which the runner reports as `invalid-response`.
 */
interface TransferEnvelope {
  transfer: TransferDto;
}

/** HTTP adapter for transfers. */
@Injectable()
export class TransferHttpAdapter extends TransferPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override create(input: CreateTransferInput): Promise<Transfer> {
    return this.runner.run(
      this.http.post<TransferEnvelope>(`${this.baseUrl}/transfers`, toCreateTransferBody(input)),
      'create-transfer',
      (raw) => mapTransfer(raw.transfer),
    );
  }

  override getById(id: string): Promise<Transfer> {
    return this.runner.run(
      this.http.get<TransferEnvelope>(`${this.baseUrl}/transfers/${id}`),
      'read',
      (raw) => mapTransfer(raw.transfer),
    );
  }
}
