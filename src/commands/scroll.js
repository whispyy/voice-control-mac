const patterns = [
  /^scroll\s+(up|down)$/i,
  /^scroll\s+(up|down)\s+(?:a\s+)?(?:bit|lot|page)$/i,
];

function match(input) {
  for (const pattern of patterns) {
    const m = input.match(pattern);
    if (m) {
      return { direction: m[1].toLowerCase() };
    }
  }
  return null;
}

async function execute(params, browser) {
  await browser.scroll(params.direction);
}

module.exports = { match, execute, description: 'Scroll the page (e.g. "scroll down")' };
