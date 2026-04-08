const record = require('node-record-lpcm16');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');
const stt = require('./stt');
const { playActivationSound, playDeactivationSound, playErrorSound } = require('./sounds');
const { parse } = require('./commands');

const MODELS_DIR = path.join(__dirname, '..', 'models');

const SAMPLE_RATE = 16000;
const DEBUG = process.env.DEBUG === '1';

function debug(...args) {
  if (DEBUG) console.log('[debug]', ...args);
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0),
      );
    }
  }
  return dp[m][n];
}

// Check if any word or word-pair in the text fuzzy-matches the trigger word
function findTriggerWord(text, triggerWord) {
  const words = text.split(/\s+/);
  const triggerWords = triggerWord.split(/\s+/);
  const triggerLen = triggerWords.length;
  const maxDist = Math.max(2, Math.floor(triggerWord.length * 0.35));

  for (let i = 0; i <= words.length - triggerLen; i++) {
    const candidate = words.slice(i, i + triggerLen).join(' ');
    const dist = levenshtein(candidate, triggerWord);
    if (dist <= maxDist) {
      debug(`Trigger match: "${candidate}" ~ "${triggerWord}" (dist=${dist}/${maxDist})`);
      return words.slice(i + triggerLen).join(' ');
    }
  }
  return null;
}

function createVadDetector() {
  return sherpa_onnx.createVad({
    sileroVad: {
      model: path.join(MODELS_DIR, 'silero_vad.onnx'),
      threshold: 0.5,
      minSilenceDuration: 0.5,
      minSpeechDuration: 0.25,
      maxSpeechDuration: 5,
      windowSize: 512,
    },
    sampleRate: SAMPLE_RATE,
    numThreads: 1,
    provider: 'cpu',
    debug: 0,
    bufferSizeInSeconds: 30,
  });
}

// Convert 16-bit PCM buffer to Float32Array [-1, 1]
function pcmBufferToFloat32(buffer) {
  const samples = new Float32Array(buffer.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
  }
  return samples;
}

class Listener {
  constructor(triggerWord, browser) {
    this.triggerWord = triggerWord.toLowerCase();
    this.browser = browser;
    this.recording = null;
    this.processing = false;
    this.phase = 'wake';
    this.commandTimeout = null;
    this.dataReceived = false;
  }

  async start() {
    console.log('Initializing...');

    stt.init();
    this.vad = createVadDetector();

    console.log('Ready.');
    console.log(`Trigger word: "${this.triggerWord}"`);
    console.log('Say the trigger word, then speak your command after the sound.');
    console.log('Listening...\n');

    this.phase = 'wake';
    this._startMic();
  }

  _startMic() {
    this.recording = record.record({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      audioType: 'raw',
      encoding: 'signed-integer',
      endian: 'little',
      bitDepth: 16,
      recorder: 'rec',
      silence: 0,
    });

    this.recording.stream().on('data', (buffer) => {
      if (!this.dataReceived) {
        this.dataReceived = true;
        debug('Mic data flowing.');
      }

      if (this.processing) return;

      const samples = pcmBufferToFloat32(buffer);

      for (let i = 0; i + 512 <= samples.length; i += 512) {
        this.vad.acceptWaveform(samples.subarray(i, i + 512));
      }

      if (!this.vad.isEmpty()) {
        const segment = this.vad.front();
        this.vad.pop();

        debug('Speech:', (segment.samples.length / SAMPLE_RATE).toFixed(1) + 's', 'phase:', this.phase);

        this.processing = true;
        this._handleSpeech(segment.samples);
      }
    });

    this.recording.stream().on('error', (err) => {
      console.error('Microphone error:', err.message);
    });

    setTimeout(() => {
      if (!this.dataReceived) {
        console.error('\nNo audio data received!');
        console.error('Check: 1) sox installed  2) mic permissions  3) mic connected');
      }
    }, 3000);
  }

  async _handleSpeech(samples) {
    try {
      const text = stt.transcribe(samples).toLowerCase().replace(/[.,!?]+$/g, '');
      debug('Transcribed:', JSON.stringify(text), 'phase:', this.phase);

      if (!text) {
        this.processing = false;
        return;
      }

      if (this.phase === 'wake') {
        const afterTrigger = findTriggerWord(text, this.triggerWord);

        if (afterTrigger !== null) {
          if (afterTrigger) {
            console.log('Trigger word detected!');
            playActivationSound();
            await this._executeCommand(afterTrigger);
            this.phase = 'wake';
            this.vad.reset();
            this.processing = false;
            return;
          }

          console.log('Trigger word detected! Say your command...');
          playActivationSound();
          this.phase = 'command';
          this.vad.reset();

          this.commandTimeout = setTimeout(() => {
            if (this.phase === 'command') {
              console.log('No command heard. Say the trigger word again.');
              playErrorSound();
              this.phase = 'wake';
              this.vad.reset();
            }
          }, 6000);
        } else {
          debug('Ignored (no trigger word):', text);
        }
      } else if (this.phase === 'command') {
        clearTimeout(this.commandTimeout);
        await this._executeCommand(text);
        this.phase = 'wake';
        this.vad.reset();
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
      playErrorSound();
      this.phase = 'wake';
    }

    this.processing = false;
  }

  async _executeCommand(text) {
    console.log(`Heard: "${text}"`);

    const parsed = parse(text);
    if (parsed) {
      try {
        await parsed.command.execute(parsed.params, this.browser);
        playDeactivationSound();
      } catch (err) {
        console.log(`Error executing command: ${err.message}`);
        playErrorSound();
      }
    } else {
      console.log(`Unknown command: "${text}"`);
      playErrorSound();
    }
  }

  stop() {
    if (this.recording) {
      this.recording.stop();
    }
    if (this.vad) this.vad.free();
    clearTimeout(this.commandTimeout);
  }
}

module.exports = Listener;
