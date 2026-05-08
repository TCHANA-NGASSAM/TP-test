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

  it('gere les montants decimaux en conservant une somme nulle', () => {
    const result = simplifyDebts({ a: 66.67, b: -33.33, c: -33.34 });

    expect(result).toEqual([
      { from: 'c', to: 'a', amount: 33.34 },
      { from: 'b', to: 'a', amount: 33.33 },
    ]);
  });

  it('retourne une liste vide quand tout est deja solde', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('ignore les membres a zero sans creer de settlement parasite', () => {
    const result = simplifyDebts({ a: 5, b: -5, c: 0, d: 0 });

    expect(result).toEqual([{ from: 'b', to: 'a', amount: 5 }]);
  });

  it('gere deux crediteurs et un debiteur sur plusieurs tours', () => {
    const result = simplifyDebts({ a: 7, b: 3, c: -10 });

    expect(result).toEqual([
      { from: 'c', to: 'a', amount: 7 },
      { from: 'c', to: 'b', amount: 3 },
    ]);
  });

  it('gere un crediteur et deux debiteurs sur plusieurs tours', () => {
    const result = simplifyDebts({ a: 10, b: -6, c: -4 });

    expect(result).toEqual([
      { from: 'b', to: 'a', amount: 6 },
      { from: 'c', to: 'a', amount: 4 },
    ]);
  });

  it('arrondit les centimes avant simplification', () => {
    const result = simplifyDebts({
      a: 10.005,
      b: -10.005,
    });

    expect(result).toEqual([{ from: 'b', to: 'a', amount: 10.01 }]);
  });

  it('ne produit jamais de settlement a montant nul', () => {
    const result = simplifyDebts({ a: 5, b: -5, c: 0 });

    expect(result).toEqual([{ from: 'b', to: 'a', amount: 5 }]);
    expect(result.every((settlement) => settlement.amount > 0)).toBe(true);
  });

  it('retourne vide quand il n y a que des crediteurs', () => {
    expect(simplifyDebts({ a: 5, b: 1, c: 0 })).toEqual([]);
  });

  it('retourne vide quand il n y a que des debiteurs', () => {
    expect(simplifyDebts({ a: -5, b: -1, c: 0 })).toEqual([]);
  });
});
