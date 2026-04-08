# Voice Control Mac

Control your browser entirely by voice from your Mac. Say a trigger word, then speak a command — no mouse or keyboard needed.

## How it works

1. **VAD** (Silero) listens to your microphone and detects when you speak
2. **Whisper** (whisper.cpp, local) transcribes what you said
3. If your **trigger word** is detected, the command is parsed and executed
4. **Playwright** controls the browser (Brave) to carry out the action

Everything runs locally — no cloud APIs, no internet required for recognition.

## Prerequisites

- **Node.js** 18+
- **sox** — for microphone capture
- **whisper-cpp** — for speech-to-text

```bash
brew install sox whisper-cpp
```

## Setup

```bash
git clone <repo-url>
cd voice-control-mac
npm install          # installs deps + downloads models automatically
```

If models didn't download automatically:

```bash
npm run download-models
```

## Configuration

Edit `.env`:

```
TRIGGER_WORD=computer
```

Pick a distinctive word — longer words work better (e.g. `computer`, `jarvis`, `hey buddy`).

Optionally set the Whisper model size:

```
WHISPER_MODEL=base.en
```

Available models: `tiny.en`, `base.en`, `small.en`, `medium.en`. Bigger = more accurate but slower.

## Usage

### Voice mode

```bash
npm run voice
```

Say your trigger word, then speak a command after the activation sound. You can also say both in one phrase (e.g. "computer open youtube").

Debug mode (shows all transcriptions):

```bash
DEBUG=1 npm run voice
```

### CLI mode (for testing)

```bash
npm start
```

Type commands directly at the `voice>` prompt.

## Available commands

| Command | Example | Action |
|---|---|---|
| open {site} | "open youtube" | Navigate to a website |
| search for {query} | "search for cats" | Search on the current page |
| click on {text} | "click on sign in" | Click an element by text |
| first/second/third video | "first video" | Click a video on YouTube |
| scroll up/down | "scroll down" | Scroll the page |
| go back / go forward | "go back" | Browser navigation |
| type {text} | "type hello" | Type into focused input |
| fullscreen | "fullscreen" | Toggle fullscreen (video) |

## Project structure

```
src/
├── index.js          # entry point (--voice or --cli mode)
├── listener.js       # mic capture + VAD + trigger word detection
├── stt.js            # whisper-cpp wrapper for transcription
├── browser.js        # Playwright browser controller
├── cli.js            # REPL for text commands
├── sounds.js         # macOS system sounds for feedback
├── commands/         # command modules (navigate, search, click, etc.)
scripts/
├── download-models.sh  # download VAD + Whisper models
├── test-mic.js         # mic/VAD diagnostics
```
