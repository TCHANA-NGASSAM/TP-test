// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balancesInCents: Record<string, number> = {};

  for (const member of group.members) {
    balancesInCents[member.id] = 0;
  }

  for (const expense of expenses) {
    const totalInCents = Math.round(expense.amount * 100);
    ensureMember(balancesInCents, expense.paidBy);
    balancesInCents[expense.paidBy] += totalInCents;

    const shares = getSharesInCents(expense, totalInCents);
    for (const share of shares) {
      ensureMember(balancesInCents, share.memberId);
      balancesInCents[share.memberId] -= share.cents;
    }
  }

  const balances: Balances = {};
  for (const [memberId, cents] of Object.entries(balancesInCents)) {
    balances[memberId] = cents / 100;
  }

  return balances;
}

type ShareInCents = {
  memberId: string;
  cents: number;
};

function ensureMember(balances: Record<string, number>, memberId: string): void {
  if (!(memberId in balances)) {
    balances[memberId] = 0;
  }
}

function getSharesInCents(expense: Expense, totalInCents: number): ShareInCents[] {
  if (expense.split.mode === 'equal') {
    const beneficiaries = expense.split.beneficiaries;
    return splitByRatiosInCents(totalInCents, beneficiaries, beneficiaries.map(() => 1));
  }

  if (expense.split.mode === 'weighted') {
    const entries = Object.entries(expense.split.weights);
    return splitByRatiosInCents(
      totalInCents,
      entries.map(([memberId]) => memberId),
      entries.map(([, weight]) => weight),
    );
  }

  const entries = Object.entries(expense.split.percentages);
  return splitByRatiosInCents(
    totalInCents,
    entries.map(([memberId]) => memberId),
    entries.map(([, percentage]) => percentage),
  );
}

function splitByRatiosInCents(
  totalInCents: number,
  memberIds: string[],
  ratios: number[],
): ShareInCents[] {
  if (memberIds.length === 0 || totalInCents === 0) {
    return [];
  }

  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (totalRatio <= 0) {
    return [];
  }

  const rawShares = memberIds.map((memberId, index) => {
    const rawCents = (totalInCents * ratios[index]) / totalRatio;
    const flooredCents = Math.floor(rawCents);
    return {
      memberId,
      flooredCents,
      fraction: rawCents - flooredCents,
    };
  });

  let allocatedCents = rawShares.reduce((sum, share) => sum + share.flooredCents, 0);
  let remainder = totalInCents - allocatedCents;

  rawShares.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < rawShares.length && remainder > 0; i += 1) {
    rawShares[i].flooredCents += 1;
    remainder -= 1;
    allocatedCents += 1;
  }

  if (allocatedCents !== totalInCents) {
    const delta = totalInCents - allocatedCents;
    rawShares[0].flooredCents += delta;
  }

  return rawShares.map((share) => ({ memberId: share.memberId, cents: share.flooredCents }));
}
