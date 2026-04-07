const { chromium } = require('playwright');

class Browser {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async launch() {
    this.browser = await chromium.launch({
      headless: false,
      executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    });
    const context = await this.browser.newContext({ viewport: null });
    this.page = await context.newPage();
    console.log('Browser launched.');
  }

  async navigate(url) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log(`Navigated to ${url}`);
  }

  async click(text) {
    try {
      const locator = this.page.getByText(text, { exact: false }).first();
      await locator.click({ timeout: 5000 });
      console.log(`Clicked on "${text}"`);
    } catch {
      // Fallback: try clicking a link or button containing the text
      try {
        await this.page.locator(`a:has-text("${text}"), button:has-text("${text}")`).first().click({ timeout: 5000 });
        console.log(`Clicked on link/button "${text}"`);
      } catch {
        console.log(`Could not find element with text "${text}"`);
      }
    }
  }

  async type(text) {
    await this.page.keyboard.type(text);
    console.log(`Typed "${text}"`);
  }

  async press(key) {
    await this.page.keyboard.press(key);
    console.log(`Pressed ${key}`);
  }

  async scroll(direction) {
    const amount = direction === 'up' ? -500 : 500;
    await this.page.mouse.wheel(0, amount);
    console.log(`Scrolled ${direction}`);
  }

  async goBack() {
    await this.page.goBack();
    console.log('Went back');
  }

  async goForward() {
    await this.page.goForward();
    console.log('Went forward');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed.');
    }
  }
}

module.exports = Browser;
