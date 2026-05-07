import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, describe, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../../src/server';

let pool: Pool;
let container: StartedPostgreSqlContainer;
let server: Awaited<ReturnType<ReturnType<typeof createApp>['listen']>>;
const providerPort = 3010;

describe('Pact provider - splitto-api', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('splitto')
      .withUsername('splitto')
      .withPassword('splitto')
      .start();

    pool = new Pool({ connectionString: container.getConnectionUri() });

    const migrationSql = await readFile(
      new URL('../../migrations/001-initial.sql', import.meta.url),
      'utf-8',
    );
    await pool.query(migrationSql);

    const app = createApp(pool);
    server = await new Promise((resolve) => {
      const started = app.listen(providerPort, () => resolve(started));
    });
  }, 90_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await pool.end();
    await container.stop();
  });

  it('honore le contrat généré par le consumer', async () => {
    await new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: `http://127.0.0.1:${providerPort}`,
      pactUrls: [path.resolve(process.cwd(), 'pacts/splitto-frontend-splitto-api.json')],
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await pool.query('TRUNCATE groups CASCADE');
          await pool.query(
            'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
            ['group-1', 'Trip', 'EUR'],
          );
          await pool.query(
            `INSERT INTO members (id, group_id, name, email) VALUES
             ('alice', 'group-1', 'Alice', 'alice@test.dev'),
             ('bob', 'group-1', 'Bob', 'bob@test.dev'),
             ('chloe', 'group-1', 'Chloe', 'chloe@test.dev')`,
          );
          await pool.query(
            `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at) VALUES
             ($1, 'group-1', 'Dinner', 30, 'EUR', 'alice', '2026-05-01T12:00:00.000Z', 'equal', $2::jsonb, '2026-05-01T12:01:00.000Z'),
             ($3, 'group-1', 'Taxi', 15, 'EUR', 'bob', '2026-05-01T14:00:00.000Z', 'equal', $4::jsonb, '2026-05-01T14:01:00.000Z')`,
            [
              'expense-1',
              JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] }),
              'expense-2',
              JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'chloe'] }),
            ],
          );
        },
        'aucun groupe inexistant': async () => {
          await pool.query('TRUNCATE groups CASCADE');
        },
      },
    }).verifyProvider();
  }, 90_000);
});
