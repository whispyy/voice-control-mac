// Quick test to diagnose mic + VAD + STT pipeline
const record = require('node-record-lpcm16');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');
const stt = require('../src/stt');

const MODELS_DIR = path.join(__dirname, '..', 'models');
const SAMPLE_RATE = 16000;

function pcmBufferToFloat32(buffer) {
  const samples = new Float32Array(buffer.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
  }
  return samples;
}

console.log('=== Mic + VAD + STT Test ===\n');

console.log('1. Loading STT (whisper-cpp)...');
try {
  stt.init();
  console.log('   STT OK\n');
} catch (err) {
  console.error('   STT FAILED:', err.message);
  process.exit(1);
}

console.log('2. Loading VAD...');
const vad = sherpa_onnx.createVad({
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
console.log('   VAD OK\n');

console.log('3. Starting mic...');
let dataChunks = 0;
let totalSamples = 0;

const recording = record.record({
  sampleRate: SAMPLE_RATE,
  channels: 1,
  audioType: 'raw',
  encoding: 'signed-integer',
  endian: 'little',
  bitDepth: 16,
  recorder: 'rec',
  silence: 0,
});

console.log('   Mic started. Speak now! (will stop after 15 seconds)\n');

recording.stream().on('data', (buffer) => {
  dataChunks++;
  const samples = pcmBufferToFloat32(buffer);
  totalSamples += samples.length;

  if (dataChunks <= 3) {
    const maxVal = Math.max(...Array.from(samples.slice(0, 100)).map(Math.abs));
    console.log(`   Chunk #${dataChunks}: ${samples.length} samples, max amplitude: ${maxVal.toFixed(4)}`);
  }

  for (let i = 0; i + 512 <= samples.length; i += 512) {
    vad.acceptWaveform(samples.subarray(i, i + 512));
  }

  if (!vad.isEmpty()) {
    const segment = vad.front();
    vad.pop();
    console.log(`\n   VAD detected speech! (${segment.samples.length} samples = ${(segment.samples.length / SAMPLE_RATE).toFixed(1)}s)`);
    console.log('   Transcribing with whisper-cpp...');

    const text = stt.transcribe(segment.samples);
    console.log(`   Result: "${text}"\n`);
  }
});

recording.stream().on('error', (err) => {
  console.error('   Mic error:', err.message);
});

setTimeout(() => {
  recording.stop();
  console.log(`\n=== Summary ===`);
  console.log(`Data chunks received: ${dataChunks}`);
  console.log(`Total samples: ${totalSamples} (${(totalSamples / SAMPLE_RATE).toFixed(1)}s of audio)`);
  if (dataChunks === 0) {
    console.log('\nPROBLEM: No audio data received!');
  }
  vad.free();
  process.exit(0);
}, 15000);
