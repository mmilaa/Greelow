import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';
import {
  requireString,
  requireNumber,
  requireCurrency,
  optionalString,
} from '../../../shared/domain/parse';

/**
 * Raw account shape from the API (`GET /accounts`). Fields are `unknown`-ish on
 * purpose: the mapper validates them.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface AccountDto {
  id: unknown;
  userId?: string;
  name: unknown;
  currency: unknown;
  balance: unknown;
  createdAt?: unknown;
}

/** Maps an account DTO to the domain Account, throwing InvalidDataError on bad data. */
export function mapAccount(dto: AccountDto): Account {
  const currency = requireCurrency(dto.currency, 'currency');
  return {
    id: requireString(dto.id, 'id'),
    name: requireString(dto.name, 'name'),
    currency,
    balance: Money.fromDecimal(requireNumber(dto.balance, 'balance'), currency),
    createdAt: optionalString(dto.createdAt),
  };
}

// --- request mapper (domain -> API body) --------------------------------

/** Body to create an account. */
export interface CreateAccountBody {
  name: string;
  currency: string;
}

/** Maps a create-account command to the API request body. */
export function toCreateAccountBody(input: { name: string; currency: string }): CreateAccountBody {
  return { name: input.name, currency: input.currency };
}
