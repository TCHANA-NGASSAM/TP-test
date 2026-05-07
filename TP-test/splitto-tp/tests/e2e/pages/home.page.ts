import { expect, type Page } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Splitto' })).toBeVisible();
  }

  async openCreateGroupDialog(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
    await expect(this.page.getByRole('dialog', { name: 'Créer un groupe' })).toBeVisible();
  }

  async createGroup(input: {
    name: string;
    membersMultiline: string;
    currency?: 'EUR' | 'USD' | 'GBP' | 'CHF';
  }): Promise<void> {
    await this.openCreateGroupDialog();
    await this.page.getByLabel('Nom du groupe').fill(input.name);
    await this.page
      .getByLabel('Devise')
      .selectOption(input.currency ?? 'EUR');
    await this.page
      .getByLabel('Membres (un par ligne, format : Nom <email>)')
      .fill(input.membersMultiline);
    await this.page.getByRole('dialog', { name: 'Créer un groupe' }).getByRole('button', { name: 'Créer' }).click();
  }

  async openGroup(name: string): Promise<void> {
    await this.page.getByRole('listitem').filter({ hasText: name }).click();
  }

  async expectGroupVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
  }
}
