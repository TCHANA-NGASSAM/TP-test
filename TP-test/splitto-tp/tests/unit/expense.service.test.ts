import { describe, expect, it } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';

class InMemoryExpenseRepository implements ExpenseRepository {
  private readonly expenses = new Map<string, Expense>();

  async save(expense: Expense): Promise<void> {
    this.expenses.set(expense.id, expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.expenses.get(id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return [...this.expenses.values()].filter((expense) => expense.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return [...this.expenses.values()].filter(
      (expense) => expense.groupId === groupId && expense.paidAt >= from && expense.paidAt <= to,
    );
  }
}

describe('ExpenseService.create', () => {
  const baseInput: CreateExpenseInput = {
    groupId: 'group-1',
    description: 'Dinner',
    amount: 120,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2026-05-06T18:00:00.000Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] },
    category: 'food',
  };

  it('cree une expense et notifie le groupe quand amount >= 100', async () => {
    // ─── STUB ───────────────────────────────────────
    const stubClock: Clock = {
      now: () => new Date('2026-05-06T20:00:00.000Z'),
    };
    const stubIdGenerator: IdGenerator = {
      next: () => 'expense-123',
    };

    // ─── SPY ────────────────────────────────────────
    const spyCalls: Array<{ groupId: string; message: string }> = [];
    const spyNotifier: EmailNotifier = {
      notifyGroupMembers: async (groupId, message) => {
        spyCalls.push({ groupId, message });
      },
    };

    // ─── MOCK ───────────────────────────────────────
    const mockLoggerCalls: string[] = [];
    const mockLogger: Logger = {
      info: (message) => {
        mockLoggerCalls.push(message);
      },
      error: () => {
        throw new Error('error() ne doit pas etre appelee');
      },
    };

    // ─── FAKE ───────────────────────────────────────
    const fakeRepository = new InMemoryExpenseRepository();

    const service = new ExpenseService(
      fakeRepository,
      spyNotifier,
      stubClock,
      stubIdGenerator,
      mockLogger,
    );

    const expense = await service.create(baseInput);

    expect(expense).toEqual({
      ...baseInput,
      id: 'expense-123',
      createdAt: new Date('2026-05-06T20:00:00.000Z'),
    });

    const savedExpense = await fakeRepository.findById('expense-123');
    expect(savedExpense).toEqual(expense);

    expect(spyCalls).toEqual([{
      groupId: 'group-1',
      message: 'Nouvelle dépense importante : Dinner (120€)',
    }]);

    expect(mockLoggerCalls).toEqual(['Expense expense-123 created']);
  });

  it("n'envoie pas de notification quand amount < 100", async () => {
    // ─── DUMMY ──────────────────────────────────────
    const dummyLogger: Logger = {
      info: () => {},
      error: () => {},
    };

    const fakeRepository = new InMemoryExpenseRepository();

    const stubClock: Clock = {
      now: () => new Date('2026-05-06T20:30:00.000Z'),
    };
    const stubIdGenerator: IdGenerator = {
      next: () => 'expense-456',
    };

    const spyCalls: Array<{ groupId: string; message: string }> = [];
    const spyNotifier: EmailNotifier = {
      notifyGroupMembers: async (groupId, message) => {
        spyCalls.push({ groupId, message });
      },
    };

    const service = new ExpenseService(
      fakeRepository,
      spyNotifier,
      stubClock,
      stubIdGenerator,
      dummyLogger,
    );

    const expense = await service.create({ ...baseInput, amount: 99, description: 'Taxi' });

    expect(expense).toEqual({
      ...baseInput,
      amount: 99,
      description: 'Taxi',
      id: 'expense-456',
      createdAt: new Date('2026-05-06T20:30:00.000Z'),
    });

    const savedExpense = await fakeRepository.findById('expense-456');
    expect(savedExpense).toEqual(expense);
    expect(spyCalls).toEqual([]);
  });
});
