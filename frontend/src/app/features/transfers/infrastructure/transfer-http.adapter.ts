import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TransferPort, type CreateTransferInput } from '../application/transfer.port';
import { type Transfer } from '../domain/transfer';
import { mapTransfer, toCreateTransferBody, type TransferDto } from './transfer.dto';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiRequestRunner } from '../../../core/http/api-request-runner';

/** HTTP adapter for transfers. */
@Injectable()
export class TransferHttpAdapter extends TransferPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override create(input: CreateTransferInput): Promise<Transfer> {
    return this.runner.run(
      this.http.post<TransferDto>(`${this.baseUrl}/transfers`, toCreateTransferBody(input)),
      'create-transfer',
      (raw) => mapTransfer(raw),
    );
  }

  override getById(id: string): Promise<Transfer> {
    return this.runner.run(
      this.http.get<TransferDto>(`${this.baseUrl}/transfers/${id}`),
      'read',
      (raw) => mapTransfer(raw),
    );
  }
}
