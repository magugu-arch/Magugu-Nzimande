import { expect, type Page, test } from '@playwright/test';
import { SCREENS } from './helpers';

/**
 * Parallax: photographs drift as they cross the screen, and stand still for
 * anyone who asks for reduced motion. Nothing in the product has a rounded
 * corner — no pills, arches or circles in the interface.
 */
const heroImage = 'main section img';

async function transformAt(page: Page, scrollY: number) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(150);
  return page
    .locator(heroImage)
    .first()
    .evaluate((img) => getComputedStyle(img).transform);
}

test('the hero photograph drifts as the page scrolls', async ({ page }) => {
  await page.goto('/');
  const atTop = await transformAt(page, 0);
  const scrolled = await transformAt(page, 320);
  expect(atTop).not.toBe('none');
  expect(scrolled).not.toBe(atTop);
});

test('photographs stay still when reduced motion is asked for', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await transformAt(page, 0)).toBe('none');
  expect(await transformAt(page, 320)).toBe('none');
});

test('the scripted fallback feeds the same drift where CSS cannot', async ({ page }) => {
  // Pretend the browser has no scroll-driven animations.
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((...args: [string, string?]) =>
      String(args[0]).includes('animation-timeline')
        ? false
        : (original as (...a: unknown[]) => boolean)(...args)) as typeof CSS.supports;
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-parallax', 'js');
  const frame = page.locator('main section img').first().locator('xpath=..');
  const read = () =>
    frame.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--parallax'));
  await page.evaluate(() => window.scrollTo(0, 40));
  await expect.poll(read).not.toBe('');
  const before = await read();
  await page.evaluate(() => window.scrollTo(0, 360));
  await expect.poll(read).not.toBe(before);
});

test('nothing in the public screens has a rounded corner', async ({ page }) => {
  // Native radio buttons keep the shape the platform gives them; everything we draw is square.
  for (const screen of SCREENS.filter((item) => item.persona === null)) {
    await page.goto(screen.path);
    await page.locator('h1').first().waitFor();
    const rounded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => {
          if (el instanceof HTMLInputElement && el.type === 'radio') return false;
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          const style = getComputedStyle(el);
          return [
            style.borderTopLeftRadius,
            style.borderTopRightRadius,
            style.borderBottomLeftRadius,
            style.borderBottomRightRadius,
          ].some((radius) => parseFloat(radius) > 0);
        })
        .map(
          (el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).slice(0, 40)}`,
        ),
    );
    expect(rounded, `rounded corners on ${screen.name}`).toEqual([]);
  }
});
