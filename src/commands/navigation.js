const patterns = [
  /^go\s+back$/i,
  /^go\s+forward$/i,
  /^back$/i,
  /^forward$/i,
];

function match(input) {
  if (/^(?:go\s+)?back$/i.test(input)) return { action: 'back' };
  if (/^(?:go\s+)?forward$/i.test(input)) return { action: 'forward' };
  return null;
}

async function execute(params, browser) {
  if (params.action === 'back') {
    await browser.goBack();
  } else {
    await browser.goForward();
  }
}

module.exports = { match, execute, description: 'Go back or forward (e.g. "go back")' };
