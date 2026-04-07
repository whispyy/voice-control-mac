const patterns = [
  /^search\s+(?:for\s+)?(.+)$/i,
  /^find\s+(.+)$/i,
  /^look up\s+(.+)$/i,
];

function match(input) {
  for (const pattern of patterns) {
    const m = input.match(pattern);
    if (m) {
      return { query: m[1].trim() };
    }
  }
  return null;
}

async function execute(params, browser) {
  const { query } = params;
  // Try to find a search input on the current page
  try {
    const searchInput = browser.page.locator(
      'input[type="search"], input[name="q"], input[name="search_query"], input[aria-label*="earch"], input[placeholder*="earch"]'
    ).first();
    await searchInput.click({ timeout: 3000 });
    await searchInput.fill(query);
    await browser.press('Enter');
    console.log(`Searched for "${query}"`);
  } catch {
    // Fallback: navigate to Google search
    await browser.navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }
}

module.exports = { match, execute, description: 'Search for something (e.g. "search for cats")' };
