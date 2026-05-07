import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Expense } from '../../src/domain/types';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';

let pool: Pool;
let repo: PgExpenseRepository;
let container: StartedPostgreSqlContainer;

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    groupId: 'group-1',
    description: 'Dinner',
    amount: 30,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2026-05-01T12:00:00.000Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] },
    createdAt: new Date('2026-05-01T12:05:00.000Z'),
    ...overrides,
  };
}

async function seedGroup(groupId: string, members: Array<{ id: string; name: string }>): Promise<void> {
  await pool.query(
    'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
    [groupId, `Group ${groupId}`, 'EUR'],
  );

  for (const member of members) {
    await pool.query(
      'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
      [member.id, groupId, member.name, `${member.id}@test.dev`],
    );
  }
}

describe('PgExpenseRepository integration', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('splitto')
      .withUsername('splitto')
      .withPassword('splitto')
      .start();

    pool = new Pool({ connectionString: container.getConnectionUri() });
    repo = new PgExpenseRepository(pool);

    const migrationSql = await readFile(
      new URL('../../migrations/001-initial.sql', import.meta.url),
      'utf-8',
    );
    await pool.query(migrationSql);
  }, 90_000);

  beforeEach(async () => {
    await pool.query('TRUNCATE expenses CASCADE');
    await seedGroup('group-1', [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'chloe', name: 'Chloe' },
    ]);
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it('save() puis findById() retourne l expense identique', async () => {
    const expense = makeExpense();

    await repo.save(expense);
    const found = await repo.findById(expense.id);

    expect(found).toEqual(expense);
  });

  it('findByGroupId() retourne uniquement les expenses du groupe demandé', async () => {
    await seedGroup('group-2', [
      { id: 'dave', name: 'Dave' },
      { id: 'eve', name: 'Eve' },
    ]);

    await repo.save(makeExpense({ id: 'g1-1', groupId: 'group-1', paidAt: new Date('2026-05-05T10:00:00.000Z') }));
    await repo.save(makeExpense({ id: 'g1-2', groupId: 'group-1', paidBy: 'bob', paidAt: new Date('2026-05-06T10:00:00.000Z') }));
    await repo.save(
      makeExpense({
        id: 'g2-1',
        groupId: 'group-2',
        paidBy: 'dave',
        split: { mode: 'equal', beneficiaries: ['dave', 'eve'] },
        paidAt: new Date('2026-05-07T10:00:00.000Z'),
      }),
    );

    const found = await repo.findByGroupId('group-1');

    expect(found.map((item) => item.id)).toEqual(['g1-2', 'g1-1']);
  });

  it('findInDateRange() filtre correctement avec bornes inclusives', async () => {
    await repo.save(makeExpense({ id: 'a', paidAt: new Date('2026-05-01T00:00:00.000Z') }));
    await repo.save(makeExpense({ id: 'b', paidBy: 'bob', paidAt: new Date('2026-05-02T12:00:00.000Z') }));
    await repo.save(makeExpense({ id: 'c', paidBy: 'chloe', paidAt: new Date('2026-05-03T00:00:00.000Z') }));

    const found = await repo.findInDateRange(
      'group-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(found.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('rejette un doublon via la contrainte UNIQUE(group_id, paid_at, amount, paid_by)', async () => {
    const paidAt = new Date('2026-05-04T12:00:00.000Z');

    await repo.save(makeExpense({ id: 'dup-1', amount: 42, paidBy: 'alice', paidAt }));

    await expect(
      repo.save(makeExpense({ id: 'dup-2', amount: 42, paidBy: 'alice', paidAt })),
    ).rejects.toThrow();
  });

  it('rollback une transaction qui échoue à mi-parcours', async () => {
    const client = await pool.connect();
    const paidAt = new Date('2026-05-09T08:00:00.000Z');

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
        [
          'tx-1',
          'group-1',
          'tx-expense-1',
          55,
          'EUR',
          'alice',
          paidAt,
          'equal',
          JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] }),
          new Date('2026-05-09T08:01:00.000Z'),
        ],
      );
      await client.query(
        `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
        [
          'tx-2',
          'group-1',
          'tx-expense-2',
          55,
          'EUR',
          'alice',
          paidAt,
          'equal',
          JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] }),
          new Date('2026-05-09T08:02:00.000Z'),
        ],
      );
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      "SELECT id FROM expenses WHERE id IN ('tx-1', 'tx-2') ORDER BY id ASC",
    );
    expect(rows).toEqual([]);
  });
});
