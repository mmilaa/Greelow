import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AccountPort } from '../application/account.port';
import { type Account } from '../../../shared/domain/account';
import { mapAccount, type AccountDto } from './account.dto';
import { API_BASE_URL } from '../../../core/config/api.config';
import { runRequest } from '../../../core/http/http-adapter.util';

/** HTTP adapter for accounts. Translates API responses into the domain. */
@Injectable()
export class AccountHttpAdapter extends AccountPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  override list(): Promise<Account[]> {
    return runRequest(
      this.http.get<{ accounts: AccountDto[] }>(`${this.baseUrl}/accounts`),
      'read',
      (raw) => raw.accounts.map(mapAccount),
    );
  }
}
