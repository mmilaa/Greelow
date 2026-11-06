import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { API_BASE_URL } from '../../../core/config/api.config';
import { TokenStoragePort } from '../application/token-storage.port';

const BASE = 'http://test-api';

class FakeTokenStorage extends TokenStoragePort {
  token: string | null = null;
  override get() {
    return this.token;
  }
  override set(t: string) {
    this.token = t;
  }
  override clear() {
    this.token = null;
  }
}

function setup(token: string | null) {
  const storage = new FakeTokenStorage();
  storage.token = token;
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
      { provide: TokenStoragePort, useValue: storage },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;

  afterEach(() => httpMock.verify());

  it('adds the Authorization header to API requests when a token is stored', () => {
    const { http, httpMock: mock } = setup('tok-1');
    httpMock = mock;
    http.get(`${BASE}/accounts`).subscribe();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({});
  });

  it('does not add the header to requests outside the API base URL (case A)', () => {
    const { http, httpMock: mock } = setup('tok-1');
    httpMock = mock;
    http.get('http://other-domain.com/data').subscribe();
    const req = httpMock.expectOne('http://other-domain.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the header to a look-alike host (prefix attack)', () => {
    const { http, httpMock: mock } = setup('tok-1');
    httpMock = mock;
    const url = `${BASE}.evil.com/data`; // http://test-api.evil.com/data
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the header to a different port', () => {
    const { http, httpMock: mock } = setup('tok-1');
    httpMock = mock;
    const url = 'http://test-api:9999/accounts';
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the header to a different protocol', () => {
    const { http, httpMock: mock } = setup('tok-1');
    httpMock = mock;
    const url = 'https://test-api/accounts';
    http.get(url).subscribe();
    const req = httpMock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the header when there is no token', () => {
    const { http, httpMock: mock } = setup(null);
    httpMock = mock;
    http.get(`${BASE}/accounts`).subscribe();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
