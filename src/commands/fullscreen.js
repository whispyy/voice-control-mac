const patterns = [
  /^(?:go\s+)?fullscreen$/i,
  /^(?:enter\s+)?fullscreen$/i,
  /^(?:exit\s+)?fullscreen$/i,
  /^(?:toggle\s+)?fullscreen$/i,
];

function match(input) {
  for (const pattern of patterns) {
    if (pattern.test(input)) {
      return {};
    }
  }
  return null;
}

async function execute(params, browser) {
  // Try YouTube fullscreen button first
  try {
    const ytButton = browser.page.locator('.ytp-fullscreen-button');
    if (await ytButton.count() > 0) {
      await ytButton.click({ timeout: 2000 });
      console.log('Toggled fullscreen (YouTube)');
      return;
    }
  } catch {}

  // Generic: press 'f' (works on most video players) or use keyboard shortcut
  try {
    await browser.page.keyboard.press('f');
    console.log('Toggled fullscreen');
  } catch {
    console.log('Could not toggle fullscreen');
  }
}

module.exports = { match, execute, description: 'Toggle fullscreen (e.g. "fullscreen", "go fullscreen")' };
