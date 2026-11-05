import { describe, it, expect } from 'vitest';
import { mapApiError, type ApiErrorResponse, type ApiOperation } from './map-api-error';

function response(status: number, body: unknown): ApiErrorResponse {
  return { status, body };
}

describe('mapApiError', () => {
  describe('validation (400 with field errors)', () => {
    it('maps a 400 { errors: [...] } to a validation error with the fields', () => {
      // docs/api-samples/07-error-400.txt
      const body = { errors: [{ field: 'amount', message: 'amount must be at least 0.01' }] };
      const result = mapApiError(response(400, body), 'create-transaction');
      expect(result).toEqual({ kind: 'validation', fields: body.errors });
    });

    it('maps a 400 { errors: [...] } in login too (case A)', () => {
      // docs/api-samples/18-error-login-validation.txt
      const body = {
        errors: [
          { field: 'email', message: 'email is required' },
          { field: 'password', message: 'password is required' },
        ],
      };
      const result = mapApiError(response(400, body), 'login');
      expect(result).toEqual({ kind: 'validation', fields: body.errors });
    });

    it('preserves the field errors verbatim (case F)', () => {
      const body = { errors: [{ field: 'email', message: 'email is required' }] };
      const result = mapApiError(response(400, body), 'login');
      expect(result).toEqual({
        kind: 'validation',
        fields: [{ field: 'email', message: 'email is required' }],
      });
    });

    it('treats an empty errors array as unknown(400)', () => {
      const result = mapApiError(response(400, { errors: [] }), 'create-transaction');
      expect(result).toEqual({ kind: 'unknown', status: 400 });
    });

    it('treats malformed field-error items as unknown(400)', () => {
      const result = mapApiError(response(400, { errors: [{ field: 1 }] }), 'create-transaction');
      expect(result).toEqual({ kind: 'unknown', status: 400 });
    });
  });

  describe('same-account (400 { error } on a transfer)', () => {
    it('maps a 400 { error } in create-transfer to same-account', () => {
      // docs/api-samples/13-error-400-same-account.txt
      const result = mapApiError(
        response(400, { error: 'Cannot transfer to the same account' }),
        'create-transfer',
      );
      expect(result).toEqual({ kind: 'same-account' });
    });

    it('does not read the message text: a 400 { error } outside a transfer is unknown(400)', () => {
      const result = mapApiError(response(400, { error: 'anything' }), 'read');
      expect(result).toEqual({ kind: 'unknown', status: 400 });
    });
  });

  describe('401', () => {
    it('maps a 401 during login to invalid-credentials (case B)', () => {
      // docs/api-samples/17-error-login-credentials.txt
      const result = mapApiError(response(401, { error: 'Invalid email or password' }), 'login');
      expect(result).toEqual({ kind: 'invalid-credentials' });
    });

    it('maps a 401 outside login to unauthenticated (case C)', () => {
      // docs/api-samples/09-error-401.txt
      const result = mapApiError(
        response(401, { error: 'Missing or invalid authorization header' }),
        'read',
      );
      expect(result).toEqual({ kind: 'unauthenticated' });
    });
  });

  describe('404 (not-found, context independent) (cases D and E)', () => {
    it('maps a 404 on a read to not-found', () => {
      // docs/api-samples/19-error-404-transaction.txt and 15-error-404-foreign-account.txt
      expect(mapApiError(response(404, { error: 'Transaction not found' }), 'read')).toEqual({
        kind: 'not-found',
      });
    });

    it('maps a 404 on a transfer to not-found', () => {
      // docs/api-samples/14-error-404-destination.txt
      expect(
        mapApiError(response(404, { error: 'Destination account not found' }), 'create-transfer'),
      ).toEqual({ kind: 'not-found' });
    });
  });

  describe('422 (insufficient funds, only for transfers) (case I)', () => {
    it('maps a 422 in create-transfer to insufficient-funds', () => {
      // docs/api-samples/08-error-422.txt
      const result = mapApiError(
        response(422, { error: 'Insufficient funds in source account' }),
        'create-transfer',
      );
      expect(result).toEqual({ kind: 'insufficient-funds' });
    });

    it('maps a 422 outside create-transfer to unknown(422)', () => {
      const result = mapApiError(response(422, { error: 'something' }), 'read');
      expect(result).toEqual({ kind: 'unknown', status: 422 });
    });
  });

  describe('network (status 0)', () => {
    it('maps status 0 to a network error', () => {
      const result = mapApiError(response(0, null), 'read');
      expect(result).toEqual({ kind: 'network' });
    });

    it('treats status 0 as network regardless of body or operation', () => {
      const result = mapApiError(response(0, { error: 'ignored' }), 'create-transfer');
      expect(result).toEqual({ kind: 'network' });
    });
  });

  describe('unknown / malformed (cases G and H)', () => {
    it('maps a 400 with neither errors nor error to unknown(400)', () => {
      expect(mapApiError(response(400, {}), 'read')).toEqual({ kind: 'unknown', status: 400 });
      expect(mapApiError(response(400, null), 'read')).toEqual({ kind: 'unknown', status: 400 });
      expect(mapApiError(response(400, 'oops'), 'read')).toEqual({ kind: 'unknown', status: 400 });
    });

    it('maps an unmapped status to unknown with the status preserved', () => {
      expect(mapApiError(response(500, { error: 'boom' }), 'read')).toEqual({
        kind: 'unknown',
        status: 500,
      });
      expect(mapApiError(response(418, null), 'read')).toEqual({ kind: 'unknown', status: 418 });
    });
  });
});
