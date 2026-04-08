#!/bin/bash
set -e

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/models"
mkdir -p "$MODELS_DIR"

echo "Downloading models to $MODELS_DIR..."

# VAD model
if [ ! -f "$MODELS_DIR/silero_vad.onnx" ]; then
  echo "Downloading Silero VAD model..."
  curl -sSL -o "$MODELS_DIR/silero_vad.onnx" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
  echo "VAD model downloaded."
else
  echo "VAD model already exists, skipping."
fi

# Moonshine Base STT model
MOONSHINE_DIR="$MODELS_DIR/sherpa-onnx-moonshine-base-en-int8"
if [ ! -d "$MOONSHINE_DIR" ]; then
  echo "Downloading Moonshine Base STT model..."
  curl -sSL -o "$MODELS_DIR/moonshine.tar.bz2" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-moonshine-base-en-int8.tar.bz2
  tar xjf "$MODELS_DIR/moonshine.tar.bz2" -C "$MODELS_DIR"
  rm "$MODELS_DIR/moonshine.tar.bz2"
  echo "Moonshine Base model downloaded."
else
  echo "Moonshine Base model already exists, skipping."
fi

echo "All models ready!"
