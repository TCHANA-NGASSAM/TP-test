import path from 'node:path';
import { describe, it } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const { like, regex } = MatchersV3;

describe('Pact consumer - GET /api/groups/:id/balances', () => {
  const provider = new PactV3({
    consumer: 'splitto-frontend',
    provider: 'splitto-api',
    dir: path.resolve(process.cwd(), 'pacts'),
  });

  it('retourne 200 avec balances quand le groupe existe', async () => {
    provider
      .given('group-1 a 3 membres et 2 dépenses')
      .uponReceiving('a request for balances of an existing group')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          groupId: like('group-1'),
          balances: like({
            alice: 20,
            bob: -10,
            chloe: -10,
          }),
          settlements: like([
            {
              from: like('bob'),
              to: like('alice'),
              amount: like(10),
            },
          ]),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/groups/group-1/balances`);
      await response.json();
    });
  });

  it('retourne 404 quand le groupe est inexistant', async () => {
    provider
      .given('aucun groupe inexistant')
      .uponReceiving('a request for balances of an unknown group')
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          error: like('Group not found'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/groups/inexistant/balances`);
      await response.json();
    });
  });
});
