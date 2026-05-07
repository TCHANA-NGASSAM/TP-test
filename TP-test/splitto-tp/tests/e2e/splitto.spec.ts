import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { GroupPage } from './pages/group.page';

const MEMBERS = `Alice <alice@test.dev>
Bob <bob@test.dev>
Chloe <chloe@test.dev>`;

async function createDefaultGroup(home: HomePage, name: string): Promise<void> {
  await home.goto();
  await home.createGroup({
    name,
    membersMultiline: MEMBERS,
    currency: 'EUR',
  });
  await home.expectGroupVisible(name);
}

test.beforeEach(async ({ request }) => {
  await request.post('/_test/reset');
});

test('Créer un groupe avec 3 membres', async ({ page }) => {
  const home = new HomePage(page);
  const groupName = 'Trip Paris';

  await createDefaultGroup(home, groupName);
});

test('Ajouter une dépense dans un groupe existant', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = 'Weekend Lyon';

  await createDefaultGroup(home, groupName);
  await home.openGroup(groupName);
  await group.expectLoaded(groupName);

  await group.addExpense({
    description: 'Restaurant',
    amount: '30',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Chloe'],
  });

  await group.expectExpenseVisible('Restaurant');
});

test('Voir les soldes mis à jour après une dépense de 30 EUR', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = 'Coloc';

  await createDefaultGroup(home, groupName);
  await home.openGroup(groupName);
  await group.expectLoaded(groupName);

  await group.addExpense({
    description: 'Courses',
    amount: '30',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Chloe'],
  });

  await group.expectBalanceForMember('Alice', '20.00 EUR');
  await group.expectBalanceForMember('Bob', '-10.00 EUR');
  await group.expectBalanceForMember('Chloe', '-10.00 EUR');
});

test('Marquer un règlement comme réglé le retire de la liste', async ({ page }) => {
  const home = new HomePage(page);
  const group = new GroupPage(page);
  const groupName = 'Vacances';

  await createDefaultGroup(home, groupName);
  await home.openGroup(groupName);
  await group.expectLoaded(groupName);

  await group.addExpense({
    description: 'Taxi',
    amount: '45',
    paidByName: 'Alice',
    beneficiaries: ['Alice', 'Bob', 'Chloe'],
  });

  await group.settleFirstSettlement();
  await group.expectFirstSettlementRemoved();
  await expect(page.getByRole('alert')).toContainText('Règlement marqué comme effectué');
});
