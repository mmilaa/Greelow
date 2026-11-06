import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthPort, type AuthUser, type LoginResult } from '../application/auth.port';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiRequestRunner } from '../../../core/http/api-request-runner';
import { InvalidDataError } from '../../../shared/domain/errors';
import { requireString } from '../../../shared/domain/parse';

interface LoginResponseDto {
  token: unknown;
  user: unknown;
}
interface MeResponseDto {
  user: unknown;
}

function mapUser(value: unknown): AuthUser {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidDataError('Expected a user object');
  }
  const u = value as Record<string, unknown>;
  return {
    id: requireString(u['id'], 'user.id'),
    email: requireString(u['email'], 'user.email'),
    name: requireString(u['name'], 'user.name'),
  };
}

/** HTTP adapter for auth. Does not persist the token: the store does. */
@Injectable()
export class AuthHttpAdapter extends AuthPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly runner = inject(ApiRequestRunner);

  override login(email: string, password: string): Promise<LoginResult> {
    return this.runner.run(
      this.http.post<LoginResponseDto>(`${this.baseUrl}/auth/login`, { email, password }),
      'login',
      (raw) => ({ token: requireString(raw.token, 'token'), user: mapUser(raw.user) }),
    );
  }

  override me(): Promise<AuthUser> {
    return this.runner.run(
      this.http.get<MeResponseDto>(`${this.baseUrl}/auth/me`),
      'read',
      (raw) => mapUser(raw.user),
    );
  }
}
