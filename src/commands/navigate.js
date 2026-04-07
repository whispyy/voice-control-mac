// Maps common site names to URLs
const SITES = {
  youtube: 'https://www.youtube.com',
  google: 'https://www.google.com',
  github: 'https://www.github.com',
  twitter: 'https://www.twitter.com',
  reddit: 'https://www.reddit.com',
  facebook: 'https://www.facebook.com',
  gmail: 'https://mail.google.com',
  linkedin: 'https://www.linkedin.com',
  wikipedia: 'https://www.wikipedia.org',
};

const patterns = [
  /^open\s+(.+)$/i,
  /^go to\s+(.+)$/i,
  /^navigate to\s+(.+)$/i,
];

function match(input) {
  for (const pattern of patterns) {
    const m = input.match(pattern);
    if (m) {
      return { site: m[1].trim().toLowerCase() };
    }
  }
  return null;
}

async function execute(params, browser) {
  const { site } = params;
  const url = SITES[site] || `https://www.${site}.com`;
  await browser.navigate(url);
}

module.exports = { match, execute, description: 'Open a website (e.g. "open youtube")' };
