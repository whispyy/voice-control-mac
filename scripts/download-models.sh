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

# KWS model
KWS_DIR="$MODELS_DIR/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01"
if [ ! -d "$KWS_DIR" ]; then
  echo "Downloading keyword spotting model..."
  curl -sSL -o "$MODELS_DIR/kws.tar.bz2" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2
  tar xjf "$MODELS_DIR/kws.tar.bz2" -C "$MODELS_DIR"
  rm "$MODELS_DIR/kws.tar.bz2"
  echo "KWS model downloaded."
else
  echo "KWS model already exists, skipping."
fi

# Moonshine Tiny STT model
MOONSHINE_DIR="$MODELS_DIR/sherpa-onnx-moonshine-tiny-en-int8"
if [ ! -d "$MOONSHINE_DIR" ]; then
  echo "Downloading Moonshine Tiny STT model..."
  curl -sSL -o "$MODELS_DIR/moonshine.tar.bz2" \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-moonshine-tiny-en-int8.tar.bz2
  tar xjf "$MODELS_DIR/moonshine.tar.bz2" -C "$MODELS_DIR"
  rm "$MODELS_DIR/moonshine.tar.bz2"
  echo "Moonshine model downloaded."
else
  echo "Moonshine model already exists, skipping."
fi

echo "All models ready!"
