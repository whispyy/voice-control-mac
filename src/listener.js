const record = require('node-record-lpcm16');
const path = require('path');
const sherpa_onnx = require('sherpa-onnx');
const { SentencePieceProcessor } = require('sentencepiece-js');
const { playActivationSound, playDeactivationSound, playErrorSound } = require('./sounds');
const { parse } = require('./commands');

const MODELS_DIR = path.join(__dirname, '..', 'models');
const KWS_DIR = path.join(MODELS_DIR, 'sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01');
const MOONSHINE_DIR = path.join(MODELS_DIR, 'sherpa-onnx-moonshine-tiny-en-int8');

const SAMPLE_RATE = 16000;

async function tokenizeKeyword(triggerWord) {
  const sp = new SentencePieceProcessor();
  await sp.load(path.join(KWS_DIR, 'bpe.model'));
  const upper = triggerWord.toUpperCase();
  const pieces = sp.encodePieces(upper);
  return pieces.join(' ');
}

async function createKws(triggerWord) {
  const keywords = await tokenizeKeyword(triggerWord);
  console.log(`Wake word tokenized: ${keywords}`);

  return sherpa_onnx.createKws({
    featConfig: { samplingRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: path.join(KWS_DIR, 'encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx'),
        decoder: path.join(KWS_DIR, 'decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx'),
        joiner: path.join(KWS_DIR, 'joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx'),
      },
      tokens: path.join(KWS_DIR, 'tokens.txt'),
      provider: 'cpu',
      numThreads: 1,
      debug: 0,
    },
    maxActivePaths: 4,
    numTrailingBlanks: 1,
    keywordsScore: 1.0,
    keywordsThreshold: 0.25,
    keywords: keywords,
  });
}

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
      minSilenceDuration: 0.8,
      minSpeechDuration: 0.25,
      maxSpeechDuration: 10,
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
    this.triggerWord = triggerWord;
    this.browser = browser;
    this.recording = null;
    this.state = 'idle'; // idle | listening_wake | listening_command
    this.commandAudio = []; // collect audio chunks during command listening
    this.commandTimeout = null;
  }

  async start() {
    console.log('Initializing voice models...');

    this.kws = await createKws(this.triggerWord);
    this.kwsStream = this.kws.createStream();

    this.recognizer = createSttRecognizer();
    this.vad = createVadDetector();

    console.log('Models loaded.');
    console.log(`Listening for wake word: "${this.triggerWord}"`);
    console.log('Say the wake word to activate, then speak your command.\n');

    this.state = 'listening_wake';
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
      const samples = pcmBufferToFloat32(buffer);

      if (this.state === 'listening_wake') {
        this._processWakeWord(samples);
      } else if (this.state === 'listening_command') {
        this._processCommand(samples);
      }
    });

    this.recording.stream().on('error', (err) => {
      console.error('Microphone error:', err.message);
    });
  }

  _processWakeWord(samples) {
    this.kwsStream.acceptWaveform(SAMPLE_RATE, samples);

    while (this.kws.isReady(this.kwsStream)) {
      this.kws.decode(this.kwsStream);
      const result = this.kws.getResult(this.kwsStream);
      if (result.keyword && result.keyword !== '') {
        console.log(`\nWake word detected! Listening for command...`);
        playActivationSound();
        this.kws.reset(this.kwsStream);

        // Switch to command mode
        this.state = 'listening_command';
        this.commandAudio = [];
        this.vad.reset();

        // Safety timeout: stop listening after 8 seconds of no speech end
        this.commandTimeout = setTimeout(() => {
          if (this.state === 'listening_command') {
            console.log('Command timeout. Going back to wake word listening.');
            playErrorSound();
            this._resetKwsStream();
            this.state = 'listening_wake';
          }
        }, 8000);

        return;
      }
    }
  }

  _processCommand(samples) {
    // Feed into VAD in 512-sample windows
    for (let i = 0; i < samples.length; i += 512) {
      const end = Math.min(i + 512, samples.length);
      const chunk = samples.subarray(i, end);
      if (chunk.length === 512) {
        this.vad.acceptWaveform(chunk);
      }
    }

    // Check if VAD has a complete speech segment
    while (!this.vad.isEmpty()) {
      const segment = this.vad.front();
      this.vad.pop();

      // Transcribe the speech segment
      clearTimeout(this.commandTimeout);
      this._transcribe(segment.samples);
      return;
    }
  }

  async _transcribe(samples) {
    const stream = this.recognizer.createStream();
    stream.acceptWaveform(SAMPLE_RATE, samples);
    this.recognizer.decode(stream);
    const result = this.recognizer.getResult(stream);
    stream.free();

    const text = (result.text || '').trim().toLowerCase();

    if (text) {
      console.log(`Heard: "${text}"`);
      playDeactivationSound();

      const parsed = parse(text);
      if (parsed) {
        try {
          await parsed.command.execute(parsed.params, this.browser);
        } catch (err) {
          console.log(`Error executing command: ${err.message}`);
          playErrorSound();
        }
      } else {
        console.log(`Unknown command: "${text}"`);
        playErrorSound();
      }
    } else {
      console.log('Could not understand. Try again.');
      playErrorSound();
    }

    // Create a fresh KWS stream to avoid stale state
    this._resetKwsStream();
    this.state = 'listening_wake';
    console.log(`Listening for wake word: "${this.triggerWord}"`);
  }

  _resetKwsStream() {
    if (this.kwsStream) {
      this.kwsStream.free();
    }
    this.kwsStream = this.kws.createStream();
  }

  stop() {
    if (this.recording) {
      this.recording.stop();
    }
    if (this.kwsStream) this.kwsStream.free();
    if (this.kws) this.kws.free();
    if (this.recognizer) this.recognizer.free();
    if (this.vad) this.vad.free();
    clearTimeout(this.commandTimeout);
  }
}

module.exports = Listener;
