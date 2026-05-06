import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Expense, Group, Member } from '../../src/domain/types';

function createGroup(members: Member[]): Group {
  return {
    id: 'group-1',
    name: 'Trip',
    currency: 'EUR',
    members,
  };
}

function createExpense(input: Partial<Expense> & Pick<Expense, 'amount' | 'paidBy' | 'split'>): Expense {
  return {
    id: 'expense-1',
    groupId: 'group-1',
    description: 'Expense',
    currency: 'EUR',
    paidAt: new Date('2026-05-01T10:00:00.000Z'),
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    ...input,
  };
}

describe('computeBalances', () => {
  const alice: Member = { id: 'alice', name: 'Alice', email: 'alice@test.dev' };
  const bob: Member = { id: 'bob', name: 'Bob', email: 'bob@test.dev' };
  const chloe: Member = { id: 'chloe', name: 'Chloe', email: 'chloe@test.dev' };

  it('retourne des soldes vides pour un groupe vide', () => {
    expect(computeBalances(createGroup([]), [])).toEqual({});
  });

  it('calcule une depense equal entre 3 personnes avec payeur beneficiaire', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        amount: 30,
        paidBy: alice.id,
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id, chloe.id] },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: 20,
      [bob.id]: -10,
      [chloe.id]: -10,
    });
  });

  it('calcule une depense equal entre 3 personnes avec payeur non beneficiaire', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        amount: 30,
        paidBy: alice.id,
        split: { mode: 'equal', beneficiaries: [bob.id, chloe.id] },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: 30,
      [bob.id]: -15,
      [chloe.id]: -15,
    });
  });

  it('gere plusieurs depenses qui se compensent partiellement', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        id: 'expense-1',
        amount: 30,
        paidBy: alice.id,
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id, chloe.id] },
      }),
      createExpense({
        id: 'expense-2',
        amount: 18,
        paidBy: bob.id,
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id, chloe.id] },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: 14,
      [bob.id]: 2,
      [chloe.id]: -16,
    });
  });

  it('calcule une depense weighted avec poids non uniformes', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        amount: 60,
        paidBy: alice.id,
        split: {
          mode: 'weighted',
          weights: {
            [alice.id]: 1,
            [bob.id]: 2,
            [chloe.id]: 3,
          },
        },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: 50,
      [bob.id]: -20,
      [chloe.id]: -30,
    });
  });

  it('calcule une depense percentage avec arrondi au centime', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        amount: 100,
        paidBy: alice.id,
        split: {
          mode: 'percentage',
          percentages: {
            [alice.id]: 33.33,
            [bob.id]: 33.33,
            [chloe.id]: 33.34,
          },
        },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result[alice.id]).toBeCloseTo(66.67, 2);
    expect(result[bob.id]).toBeCloseTo(-33.33, 2);
    expect(result[chloe.id]).toBeCloseTo(-33.34, 2);
    expect(result[alice.id] + result[bob.id] + result[chloe.id]).toBeCloseTo(0, 2);
  });

  it('retourne les membres a zero quand la liste de depenses est vide', () => {
    const group = createGroup([alice, bob, chloe]);

    const result = computeBalances(group, []);

    expect(result).toEqual({
      [alice.id]: 0,
      [bob.id]: 0,
      [chloe.id]: 0,
    });
  });

  it('integre un membre supprime present dans une vieille depense', () => {
    const group = createGroup([alice, bob]);
    const expenses = [
      createExpense({
        amount: 45,
        paidBy: 'old-member',
        split: { mode: 'equal', beneficiaries: [alice.id, bob.id] },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: -22.5,
      [bob.id]: -22.5,
      'old-member': 45,
    });
  });

  it('laisse tous les soldes a zero pour une depense a beneficiaire unique payeur', () => {
    const group = createGroup([alice, bob, chloe]);
    const expenses = [
      createExpense({
        amount: 80,
        paidBy: alice.id,
        split: { mode: 'equal', beneficiaries: [alice.id] },
      }),
    ];

    const result = computeBalances(group, expenses);

    expect(result).toEqual({
      [alice.id]: 0,
      [bob.id]: 0,
      [chloe.id]: 0,
    });
  });
});