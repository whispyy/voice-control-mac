const readline = require('readline');
const { parse, listCommands } = require('./commands');

function startCli(browser) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'voice> ',
  });

  console.log('\nVoice Control Mac - CLI Mode');
  console.log('Type commands as if speaking. Type "help" for available commands, "quit" to exit.\n');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'quit' || input === 'exit') {
      await browser.close();
      process.exit(0);
    }

    if (input === 'help') {
      console.log('\nAvailable commands:');
      console.log(listCommands());
      console.log('  - help: Show this help');
      console.log('  - quit: Exit the program\n');
      rl.prompt();
      return;
    }

    const result = parse(input);
    if (result) {
      try {
        await result.command.execute(result.params, browser);
      } catch (err) {
        console.log(`Error: ${err.message}`);
      }
    } else {
      console.log(`Unknown command: "${input}". Type "help" for available commands.`);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await browser.close();
    process.exit(0);
  });
}

module.exports = { startCli };
