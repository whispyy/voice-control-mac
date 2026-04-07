const { exec } = require('child_process');
const path = require('path');

// Use macOS built-in afplay for sound playback
function playActivationSound() {
  // Use a system sound as activation beep
  const soundFile = '/System/Library/Sounds/Tink.aiff';
  exec(`afplay "${soundFile}"`, (err) => {
    if (err) {
      console.log('Could not play activation sound');
    }
  });
}

function playDeactivationSound() {
  const soundFile = '/System/Library/Sounds/Pop.aiff';
  exec(`afplay "${soundFile}"`, (err) => {
    if (err) {
      console.log('Could not play deactivation sound');
    }
  });
}

function playErrorSound() {
  const soundFile = '/System/Library/Sounds/Basso.aiff';
  exec(`afplay "${soundFile}"`, (err) => {
    if (err) {
      console.log('Could not play error sound');
    }
  });
}

module.exports = { playActivationSound, playDeactivationSound, playErrorSound };
