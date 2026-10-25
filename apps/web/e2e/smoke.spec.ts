import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** A fresh account per test: tests run in parallel against one database */
const register = async (page: Page, name = 'Ильдар Сафин') => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Имя').fill(name);
  await page.getByLabel('Почта').fill(email);
  await page.getByLabel('Пароль').fill('password123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('heading', { name: 'Матчи' })).toBeVisible();
  return email;
};

/** Matches of all tests share one list: names must not repeat */
const unique = (name: string) =>
  `${name} ${Math.random().toString(36).slice(2, 7)}`;

const createMatch = async (page: Page, name: string) => {
  await page.goto('/events/new');
  await page.getByLabel('Название').fill(name);
  await page.getByLabel('Место').fill('Стадион «Динамо», поле 2');
  // A week ahead, so the match is upcoming whatever day the tests run
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Дата').fill(day);
  await page.getByLabel('Время').fill('20:00');
  await page.getByRole('button', { name: 'Создать матч' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};

test('a player signs up for a match and leaves it', async ({ page }) => {
  await register(page);
  const match = unique('Вторничный футбол');
  await createMatch(page, match);

  const join = page.getByRole('region', { name: 'Запись на матч' });
  await join.getByRole('button', { name: 'Иду' }).click();
  const roster = page.getByRole('region', { name: 'Состав' });
  await expect(roster).toContainText('Ильдар Сафин');
  await expect(page.getByRole('region', { name: 'Ваша запись' })).toBeVisible();

  // The sign-up survives a reload: it came from the server, not only from the cache
  await page.reload();
  await expect(page.getByRole('region', { name: 'Состав' })).toContainText(
    'Ильдар Сафин',
  );

  await page.getByRole('button', { name: 'Не пойду' }).click();
  await expect(
    page.getByRole('region', { name: 'Запись на матч' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Состав' })).not.toContainText(
    'Ильдар Сафин',
  );

  // The match is listed, and the list leads back to it
  await page.goto('/events');
  await page.getByRole('heading', { name: match }).click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9]{24}$/);
});

test('installs as an app and shows the match list offline', async ({
  page,
  context,
}) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(await manifest.json()).toMatchObject({
    display: 'standalone',
    start_url: '/events',
  });

  await register(page);
  const match = unique('Офлайн-матч');
  await createMatch(page, match);
  await page.goto('/events');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Under the service worker now: the list is saved on the way
  await page.reload();
  await expect(page.getByRole('heading', { name: match })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: match })).toBeVisible();
  await context.setOffline(false);
});

test('signing out returns to the login page and protects the app', async ({
  page,
}) => {
  await register(page, 'Мария Котова');
  await page.goto('/account');
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();

  await page.goto('/events');
  await expect(page).toHaveURL(/\/login/);
});

test('an unknown match says so at once', async ({ page }) => {
  await register(page, 'Глеб Орлов');
  await page.goto('/events/0123456789abcdef01234567');
  await expect(
    page.getByRole('heading', { name: 'Матч не найден' }),
  ).toBeVisible({
    timeout: 3000,
  });
});

test('key screens have no accessibility violations', async ({ page }) => {
  // Cards fade in; axe must see the final colours, not a frame of the animation
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const check = async () => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([]);
  };

  await page.goto('/login');
  await check();
  await register(page, 'Тимур Ахмедов');
  await check();
  await createMatch(page, unique('Субботняя игра'));
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Матчи' })).toBeVisible();
  await check();
  await check();
});
