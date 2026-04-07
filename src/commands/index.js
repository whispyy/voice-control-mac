const navigate = require('./navigate');
const search = require('./search');
const click = require('./click');
const scroll = require('./scroll');
const type = require('./type');
const navigation = require('./navigation');
const video = require('./video');
const fullscreen = require('./fullscreen');

// Order matters: more specific patterns first
const commands = [
  navigation,  // "go back" before navigate's "go to"
  video,       // "first video" before generic click
  fullscreen,  // "go fullscreen" before navigate's "go to"
  navigate,
  search,
  click,
  scroll,
  type,
];

function parse(input) {
  const trimmed = input.trim();
  for (const command of commands) {
    const params = command.match(trimmed);
    if (params) {
      return { command, params };
    }
  }
  return null;
}

function listCommands() {
  return commands.map(c => `  - ${c.description}`).join('\n');
}

module.exports = { parse, listCommands };
