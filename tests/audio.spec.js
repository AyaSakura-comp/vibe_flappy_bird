import { test, expect } from '@playwright/test';

test('audio fades in on game start and fades out on game over', async ({ page }) => {
  await page.goto('http://localhost:3457');
  await page.waitForSelector('#overlay');
  
  // Click left side to start
  await page.mouse.click(100, 100);
  
  // Wait for game start
  await expect(async () => {
    const started = await page.evaluate(() => window.__FLAPPY_STARTED);
    expect(started).toBe(true);
  }).toPass();

  // Freeze gravity to observe fade in
  await page.evaluate(() => window.__FLAPPY_GRAVITY_SCALE = 0);
  
  // Check volume is increasing
  await page.waitForTimeout(200);
  const v1 = await page.evaluate(() => window.__GAME_AUDIO.volume);
  expect(v1).toBeGreaterThan(0);
  
  await page.waitForTimeout(800);
  const v2 = await page.evaluate(() => window.__GAME_AUDIO.volume);
  expect(v2).toBeGreaterThan(v1);
  expect(v2).toBeLessThan(0.601);

  // Trigger game over manually to check fade out
  await page.evaluate(() => {
    // We can't easily call triggerGameOver because it's local, 
    // but we can move the bird to cause it.
    window.__FLAPPY_GRAVITY_SCALE = 1;
    window.__GAME_AUDIO.volume = 0.6; // Ensure it's at target before fade out
    // Move bird out of bounds
    const bird = document.querySelector('canvas'); // Not really bird, but we need to trigger it in game.js
    // Actually we can just wait for a pipe if we didn't clear them, 
    // or just wait for bird to fall (gravity 1).
  });
  
  // Wait for game over
  await expect(async () => {
    const over = await page.evaluate(() => window.__FLAPPY_OVER);
    expect(over).toBe(true);
  }).toPass({ timeout: 10000 });

  // Volume should be decreasing
  await page.waitForTimeout(200);
  const vOut = await page.evaluate(() => window.__GAME_AUDIO.volume);
  expect(vOut).toBeLessThan(0.6);
  
  // Eventually volume should be 0 and paused
  await expect(async () => {
    const vol = await page.evaluate(() => window.__GAME_AUDIO.volume);
    const paused = await page.evaluate(() => window.__GAME_AUDIO.paused);
    expect(vol).toBe(0);
    expect(paused).toBe(true);
  }).toPass({ timeout: 2000 });
});
