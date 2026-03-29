import { test, expect } from '@playwright/test';

test('verify redesign', async ({ page }) => {
  // Inject mock token into localStorage
  await page.goto('http://localhost:5173/login');
  await page.evaluate(() => {
    localStorage.setItem('sfms_access_token', 'mock-token');
  });

  // Navigate to Dashboard
  await page.goto('http://localhost:5173/');

  // Wait a bit for animations
  await page.waitForTimeout(2000);

  // Take screenshot to see where we are
  await page.screenshot({ path: '/home/jules/verification/screenshots/debug_auth.png', fullPage: true });

  // Wait for the main content to load
  try {
    await page.waitForSelector('text=Storage Overview', { timeout: 5000 });
  } catch (e) {
    console.log("Could not find Storage Overview, checking for other elements");
    const content = await page.content();
    console.log("Page content snippet:", content.substring(0, 1000));
  }

  await page.screenshot({ path: '/home/jules/verification/screenshots/dashboard_v2.png', fullPage: true });

  // Navigate to File Manager
  const fileManagerLink = page.locator('a:has-text("File Manager")');
  await fileManagerLink.click();

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/jules/verification/screenshots/file_manager_v2.png', fullPage: true });

  // Test Dark Mode
  const themeToggle = page.locator('button').filter({ has: page.locator('svg') }).last();
  await themeToggle.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/jules/verification/screenshots/dark_mode_v2.png', fullPage: true });
});
