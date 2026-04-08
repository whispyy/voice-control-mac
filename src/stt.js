const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODELS_DIR = path.join(__dirname, '..', 'models');

// Whisper model to use (downloaded by scripts/download-models.sh)
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base.en';
const MODEL_PATH = path.join(MODELS_DIR, `ggml-${WHISPER_MODEL}.bin`);

// Find whisper-cpp binary
function findWhisperBinary() {
  const candidates = [
    'whisper-cpp',      // homebrew name
    'whisper',          // alternative name
    '/usr/local/bin/whisper-cpp',
    '/opt/homebrew/bin/whisper-cpp',
  ];

  for (const bin of candidates) {
    try {
      execFileSync('which', [bin], { stdio: 'pipe' });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

let whisperBin = null;

function init() {
  whisperBin = findWhisperBinary();
  if (!whisperBin) {
    throw new Error(
      'whisper-cpp not found. Install it with: brew install whisper-cpp'
    );
  }

  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(
      `Whisper model not found at ${MODEL_PATH}\nRun: npm run download-models`
    );
  }

  console.log(`Using whisper-cpp: ${whisperBin}`);
  console.log(`Using model: ${WHISPER_MODEL} (${MODEL_PATH})`);
}

// Transcribe a Float32Array of 16kHz mono audio
function transcribe(samples) {
  // Write samples to a temporary WAV file
  const tmpFile = path.join(os.tmpdir(), `voice-ctrl-${Date.now()}.wav`);

  try {
    writeWav(tmpFile, samples, 16000);

    // Run whisper-cpp
    const output = execFileSync(whisperBin, [
      '-m', MODEL_PATH,
      '-f', tmpFile,
      '-l', 'en',
      '--no-timestamps',
      '-t', '2',          // 2 threads
      '--print-special', 'false',
    ], {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse output: whisper-cpp prints lines like "[00:00:00.000 --> 00:00:02.000]  text here"
    // With --no-timestamps it just prints the text
    const text = output
      .split('\n')
      .map(line => line.replace(/^\[.*?\]\s*/, '').trim())
      .filter(line => line && !line.startsWith('['))
      .join(' ')
      .trim();

    return text;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// Write Float32Array samples as a 16-bit PCM WAV file
function writeWav(filePath, samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // chunk size
  buffer.writeUInt16LE(1, 20);            // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples as 16-bit PCM
  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), headerSize + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

module.exports = { init, transcribe };
