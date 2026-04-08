const record = require('node-record-lpcm16');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');
const { playActivationSound, playDeactivationSound, playErrorSound } = require('./sounds');
const { parse } = require('./commands');

const MODELS_DIR = path.join(__dirname, '..', 'models');
const MOONSHINE_DIR = path.join(MODELS_DIR, 'sherpa-onnx-moonshine-base-en-int8');

const SAMPLE_RATE = 16000;

function createSttRecognizer() {
  return sherpa_onnx.createOfflineRecognizer({
    modelConfig: {
      moonshine: {
        preprocessor: path.join(MOONSHINE_DIR, 'preprocess.onnx'),
        encoder: path.join(MOONSHINE_DIR, 'encode.int8.onnx'),
        uncachedDecoder: path.join(MOONSHINE_DIR, 'uncached_decode.int8.onnx'),
        cachedDecoder: path.join(MOONSHINE_DIR, 'cached_decode.int8.onnx'),
      },
      tokens: path.join(MOONSHINE_DIR, 'tokens.txt'),
      numThreads: 1,
      debug: 0,
    },
  });
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
  }

  async start() {
    console.log('Initializing voice models...');

    this.recognizer = createSttRecognizer();
    this.vad = createVadDetector();

    console.log('Models loaded.');
    console.log(`Trigger word: "${this.triggerWord}"`);
    console.log('Say the trigger word followed by your command (e.g. "' + this.triggerWord + ' open youtube")');
    console.log('Listening...\n');

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
    });

    this.recording.stream().on('data', (buffer) => {
      if (this.processing) return;

      const samples = pcmBufferToFloat32(buffer);

      // Feed into VAD in 512-sample windows
      for (let i = 0; i + 512 <= samples.length; i += 512) {
        this.vad.acceptWaveform(samples.subarray(i, i + 512));
      }

      // Check if VAD has a complete speech segment
      if (!this.vad.isEmpty()) {
        const segment = this.vad.front();
        this.vad.pop();

        this.processing = true;
        this._handleSpeech(segment.samples);
      }
    });

    this.recording.stream().on('error', (err) => {
      console.error('Microphone error:', err.message);
    });
  }

  async _handleSpeech(samples) {
    try {
      // Transcribe
      const stream = this.recognizer.createStream();
      stream.acceptWaveform(SAMPLE_RATE, samples);
      this.recognizer.decode(stream);
      const result = this.recognizer.getResult(stream);
      stream.free();

      const text = (result.text || '').trim().toLowerCase()
        .replace(/[.,!?]+$/g, '');

      if (!text) {
        this.processing = false;
        return;
      }

      // Check if text starts with trigger word
      if (!text.startsWith(this.triggerWord)) {
        // Not a command, ignore
        this.processing = false;
        return;
      }

      // Extract the command part after the trigger word
      const command = text.slice(this.triggerWord.length).trim();

      if (!command) {
        // Just the trigger word with no command
        console.log('Trigger word detected but no command heard.');
        playActivationSound();
        this.processing = false;
        return;
      }

      console.log(`Heard: "${command}"`);
      playActivationSound();

      const parsed = parse(command);
      if (parsed) {
        try {
          await parsed.command.execute(parsed.params, this.browser);
          playDeactivationSound();
        } catch (err) {
          console.log(`Error executing command: ${err.message}`);
          playErrorSound();
        }
      } else {
        console.log(`Unknown command: "${command}"`);
        playErrorSound();
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
      playErrorSound();
    }

    this.processing = false;
  }

  stop() {
    if (this.recording) {
      this.recording.stop();
    }
    if (this.recognizer) this.recognizer.free();
    if (this.vad) this.vad.free();
  }
}

module.exports = Listener;
