import { describe, expect, it } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('retourne un seul settlement pour 2 personnes', () => {
    const result = simplifyDebts({ a: 10, b: -10 });

    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('evite un passage inutile par un membre a zero', () => {
    const result = simplifyDebts({ a: 10, b: 0, c: -10 });

    expect(result).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
    expect(result).toHaveLength(1);
  });

  it('calcule le nombre minimal de settlements pour un cas simple a 4 membres', () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });

    expect(result).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
    expect(result).toHaveLength(2);
  });
});
