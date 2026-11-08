import { describe, it, expect } from 'vitest';
import { leavesNegative } from './leaves-negative';
import { Money } from '../../../shared/domain/money';

const ARS = 'ARS';
const money = (n: number) => Money.fromDecimal(n, ARS);

describe('leavesNegative', () => {
  it('is true for an expense that leaves the balance below zero', () => {
    expect(leavesNegative('expense', money(440), money(1000))).toBe(true);
  });

  it('is false for an expense that lands exactly on zero', () => {
    expect(leavesNegative('expense', money(1000), money(1000))).toBe(false);
  });

  it('is false for an expense that stays positive', () => {
    expect(leavesNegative('expense', money(1000), money(600))).toBe(false);
  });

  it('is false when the available balance is unknown', () => {
    expect(leavesNegative('expense', null, money(1000))).toBe(false);
  });

  it('is false for an income regardless of the amount', () => {
    expect(leavesNegative('income', money(0), money(1000))).toBe(false);
    expect(leavesNegative('income', null, money(1000))).toBe(false);
  });

  it('is true for an expense when the account is already negative', () => {
    expect(leavesNegative('expense', money(-100), money(1))).toBe(true);
  });
});
