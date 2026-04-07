const ORDINALS = {
  first: 0, '1st': 0,
  second: 1, '2nd': 1,
  third: 2, '3rd': 2,
  fourth: 3, '4th': 3,
  fifth: 4, '5th': 4,
};

const patterns = [
  /^(?:click on |play |open )?(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s+video$/i,
  /^play video$/i,
];

function match(input) {
  const m = input.match(patterns[0]);
  if (m) {
    return { index: ORDINALS[m[1].toLowerCase()] ?? 0 };
  }
  if (patterns[1].test(input)) {
    return { index: 0 };
  }
  return null;
}

async function execute(params, browser) {
  const { index } = params;
  // YouTube-specific: video thumbnails are links with id="video-title-link" or a#video-title
  try {
    const videos = browser.page.locator('a#video-title-link, a#video-title, ytd-rich-item-renderer a#thumbnail');
    const count = await videos.count();
    if (count === 0) {
      // Generic fallback: look for any video link/thumbnail
      const generic = browser.page.locator('a:has(img)').filter({ hasText: /.+/ });
      await generic.nth(index).click({ timeout: 5000 });
    } else {
      await videos.nth(index).click({ timeout: 5000 });
    }
    console.log(`Clicked on video #${index + 1}`);
  } catch {
    console.log(`Could not find video #${index + 1} on this page`);
  }
}

module.exports = { match, execute, description: 'Play a video (e.g. "play the first video", "click on the second video")' };
