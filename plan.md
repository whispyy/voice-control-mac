# Voice Control Mac - Project Plan

## Goal
Control a Mac browser entirely by voice (or CLI text input), replacing mouse and keyboard.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌────────────┐
│  Mic Input   │────>│  Vosk STT    │────>│ Command Parser │────>│ Playwright │
│  (portaudio) │     │ (wake word + │     │ (regex rules)  │     │ (browser)  │
└─────────────┘     │  commands)   │     └────────────────┘     └────────────┘
                     └──────────────┘              ^
                                                   │
                     ┌──────────────┐              │
                     │   CLI REPL   │──────────────┘
                     │  (text input)│
                     └──────────────┘
```

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Wake word + STT | Vosk (local, offline) |
| Command interpreter | Regex/string pattern matching (no LLM) |
| Browser control | Playwright (Chromium) |
| Audio input | portaudio / node-record-lpcm16 |
| Activation sound | node-speaker or play-sound |
| CLI | Built-in REPL |
| Config | dotenv (.env file with TRIGGER_WORD) |

## Project Structure

```
voice-control-mac/
├── package.json
├── .env                    # TRIGGER_WORD=hey computer
├── plan.md
├── src/
│   ├── index.js            # entry point, wires everything
│   ├── listener.js         # mic + Vosk wake word + STT
│   ├── parser.js           # command pattern matching
│   ├── browser.js          # Playwright browser controller
│   ├── cli.js              # REPL for typing commands
│   ├── sounds.js           # play activation sound
│   └── commands/
│       ├── navigate.js     # "open youtube", "go to google"
│       ├── search.js       # "search for X"
│       ├── click.js        # "click on X"
│       ├── scroll.js       # "scroll up/down"
│       └── index.js        # command registry
└── assets/
    └── activate.wav        # activation sound
```

## Commands (v1)

| Command | Example | Action |
|---|---|---|
| open {site} | "open youtube" | Navigate to youtube.com |
| search for {query} | "search for cats" | Type query in search/URL bar + enter |
| click on {text} | "click on the first video" | Find and click element containing text |
| scroll up/down | "scroll down" | Scroll the page |
| go back / go forward | "go back" | Browser navigation |
| type {text} | "type hello world" | Type into focused input |

## Implementation Phases

### Phase 1 - CLI + Browser Foundation
- [x] Write plan.md
- [x] Scaffold project (package.json, folder structure)
- [x] Implement browser.js (Playwright wrapper using Brave)
- [x] Implement command modules (navigate, search, click, scroll, type, video, fullscreen)
- [x] Implement cli.js (REPL that reads text input and dispatches commands)
- [x] Wire up index.js to start CLI mode

### Phase 2 - Voice Input
- [x] Install sherpa-onnx + node-record-lpcm16 + sentencepiece-js
- [x] Download models (KWS zipformer, Moonshine Tiny, Silero VAD)
- [x] Implement listener.js (mic capture + KWS wake word + VAD + Moonshine STT)
- [x] Dynamic BPE tokenization for any custom trigger word
- [x] Activation/deactivation/error sounds (macOS system sounds)
- [x] Wire voice mode into index.js (--voice flag)
- [ ] Test end-to-end voice flow

### Phase 3 - Polish
- [ ] Error handling and user feedback (spoken or visual)
- [ ] More commands (new tab, close tab, refresh, bookmark)
- [ ] Fuzzy matching for click targets
- [ ] Configuration file for custom command aliases
