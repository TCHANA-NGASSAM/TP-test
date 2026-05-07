import { expect, type Page } from '@playwright/test';

export class GroupPage {
  constructor(private readonly page: Page) {}

  async expectLoaded(groupName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: new RegExp(groupName) })).toBeVisible();
  }

  async addExpense(input: {
    description: string;
    amount: string;
    paidByName: string;
    beneficiaries: string[];
  }): Promise<void> {
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).click();
    await expect(this.page.getByRole('dialog', { name: 'Ajouter une dépense' })).toBeVisible();

    await this.page.getByLabel('Description').fill(input.description);
    await this.page.getByLabel('Montant').fill(input.amount);
    await this.page.getByLabel('Payé par').selectOption({ label: input.paidByName });

    const beneficiariesContainer = this.page.getByLabel('Bénéficiaires (cochez)');
    for (const memberName of input.beneficiaries) {
      await beneficiariesContainer.getByRole('checkbox', { name: memberName }).check();
    }

    await this.page.getByRole('dialog', { name: 'Ajouter une dépense' }).getByRole('button', { name: 'Ajouter' }).click();
  }

  async expectExpenseVisible(description: string): Promise<void> {
    await expect(this.page.getByRole('table', { name: 'Liste des dépenses' }).getByRole('cell', { name: description })).toBeVisible();
  }

  async expectBalanceForMember(memberName: string, amountWithCurrency: string): Promise<void> {
    const row = this.page
      .getByRole('table', { name: 'Soldes des membres' })
      .getByRole('row')
      .filter({ hasText: memberName });
    await expect(row).toContainText(amountWithCurrency);
  }

  async settleFirstSettlement(): Promise<void> {
    const table = this.page.getByRole('table', { name: 'Règlements' });
    await expect(table).toBeVisible();
    const firstRow = this.page.getByTestId('settlement-row-0');
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: 'Régler' }).click();
  }

  async expectFirstSettlementRemoved(): Promise<void> {
    await expect(this.page.getByTestId('settlement-row-0')).toBeHidden();
  }
}
