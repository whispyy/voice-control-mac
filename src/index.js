require('dotenv').config();

const Browser = require('./browser');
const { startCli } = require('./cli');
const Listener = require('./listener');

const mode = process.argv.includes('--voice') ? 'voice' : 'cli';

async function main() {
  const browser = new Browser();

  console.log('Launching browser...');
  await browser.launch();

  if (mode === 'voice') {
    const triggerWord = process.env.TRIGGER_WORD || 'hey siri';
    console.log(`Starting voice mode with trigger word: "${triggerWord}"`);
    const listener = new Listener(triggerWord, browser);

    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      listener.stop();
      browser.close().then(() => process.exit(0));
    });

    await listener.start();
  } else {
    startCli(browser);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
