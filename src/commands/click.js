const patterns = [
  /^click\s+(?:on\s+)?(?:the\s+)?(.+)$/i,
  /^press\s+(?:on\s+)?(?:the\s+)?(.+)$/i,
  /^tap\s+(?:on\s+)?(?:the\s+)?(.+)$/i,
];

function match(input) {
  for (const pattern of patterns) {
    const m = input.match(pattern);
    if (m) {
      return { target: m[1].trim() };
    }
  }
  return null;
}

async function execute(params, browser) {
  const { target } = params;
  await browser.click(target);
}

module.exports = { match, execute, description: 'Click on an element (e.g. "click on Sign In")' };
