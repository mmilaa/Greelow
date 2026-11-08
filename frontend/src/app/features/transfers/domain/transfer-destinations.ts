import { type Account } from '../../../shared/domain/account';

/**
 * Which own accounts can receive a transfer from a given source, and why not
 * when they cannot. This decides what the destination selector offers and the
 * reason it shows; the final go/no-go is still canTransfer in the store (the
 * single authority). Pure TypeScript: no `@angular/*` imports.
 *
 * A destination is ineligible when it is the source account itself
 * (`same-account`) or when its currency differs from the source's
 * (`cross-currency`). With no source chosen yet, nothing is eligible: the user
 * must pick the origin first.
 */

/** Why a destination cannot be chosen, or null when it is eligible. */
export type DestinationIneligibleReason = 'same-account' | 'cross-currency';

export interface DestinationOption {
  account: Account;
  eligible: boolean;
  /** The reason it is ineligible, or null when eligible. */
  reason: DestinationIneligibleReason | null;
}

/**
 * Builds the destination options for a source account id. When `originId` is
 * null (no source chosen), every option is ineligible with no specific reason
 * (the UI shows a single "choose the origin first" hint, not a per-row reason).
 */
export function eligibleDestinations(
  originId: string | null,
  accounts: Account[],
): DestinationOption[] {
  const source = originId === null ? null : accounts.find((a) => a.id === originId) ?? null;

  return accounts.map((account) => {
    if (source === null) {
      // No origin chosen yet: nothing selectable, and no per-row reason.
      return { account, eligible: false, reason: null };
    }
    if (account.id === source.id) {
      return { account, eligible: false, reason: 'same-account' };
    }
    if (account.currency !== source.currency) {
      return { account, eligible: false, reason: 'cross-currency' };
    }
    return { account, eligible: true, reason: null };
  });
}

/** True when at least one destination is eligible for the given source. */
export function hasEligibleDestination(
  originId: string | null,
  accounts: Account[],
): boolean {
  return eligibleDestinations(originId, accounts).some((o) => o.eligible);
}
