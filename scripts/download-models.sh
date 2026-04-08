#!/bin/bash
set -e

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/models"
mkdir -p "$MODELS_DIR"

WHISPER_MODEL="${WHISPER_MODEL:-base.en}"

echo "Downloading models to $MODELS_DIR..."

# VAD model (Silero, used by sherpa-onnx)
if [ ! -f "$MODELS_DIR/silero_vad.onnx" ]; then
  echo "Downloading Silero VAD model..."
  curl -sSL -o "$MODELS_DIR/silero_vad.onnx" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
  echo "VAD model downloaded."
else
  echo "VAD model already exists, skipping."
fi

# Whisper model (used by whisper-cpp for STT)
WHISPER_FILE="$MODELS_DIR/ggml-${WHISPER_MODEL}.bin"
if [ ! -f "$WHISPER_FILE" ]; then
  echo "Downloading Whisper ${WHISPER_MODEL} model..."
  curl -sSL -o "$WHISPER_FILE" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin"
  echo "Whisper model downloaded."
else
  echo "Whisper model already exists, skipping."
fi

echo "All models ready!"
