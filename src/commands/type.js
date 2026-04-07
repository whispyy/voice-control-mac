const patterns = [
  /^type\s+(.+)$/i,
  /^write\s+(.+)$/i,
  /^enter\s+(.+)$/i,
];

function match(input) {
  for (const pattern of patterns) {
    const m = input.match(pattern);
    if (m) {
      return { text: m[1].trim() };
    }
  }
  return null;
}

async function execute(params, browser) {
  await browser.type(params.text);
}

module.exports = { match, execute, description: 'Type text into focused input (e.g. "type hello world")' };
