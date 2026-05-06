// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const creditors = new Map<string, number>();
  const debtors = new Map<string, number>();

  for (const [memberId, balance] of Object.entries(balances)) {
    if (balance > 0) {
      creditors.set(memberId, balance);
    } else if (balance < 0) {
      debtors.set(memberId, Math.abs(balance));
    }
  }

  const settlements: Settlement[] = [];

  while (creditors.size > 0 && debtors.size > 0) {
    const creditorEntry = [...creditors.entries()].sort((a, b) => b[1] - a[1])[0];
    const debtorEntry = [...debtors.entries()].sort((a, b) => b[1] - a[1])[0];
    const settledAmount = Math.min(creditorEntry[1], debtorEntry[1]);

    settlements.push({
      from: debtorEntry[0],
      to: creditorEntry[0],
      amount: settledAmount,
    });

    const creditorRemaining = creditorEntry[1] - settledAmount;
    const debtorRemaining = debtorEntry[1] - settledAmount;

    if (creditorRemaining === 0) {
      creditors.delete(creditorEntry[0]);
    } else {
      creditors.set(creditorEntry[0], creditorRemaining);
    }

    if (debtorRemaining === 0) {
      debtors.delete(debtorEntry[0]);
    } else {
      debtors.set(debtorEntry[0], debtorRemaining);
    }
  }

  return settlements;
}
