# Codex Runtime Integration

This file is generated. Do not edit by hand.

- Config file: AGENTS.md
- Snippet target: .codex/AGENTS.md or project AGENTS.md
- Capability level: full
- Supported executors: codex, claude, openai

## Injection Snippet

## The Agency HQ

Use The Agency HQ as the runtime source of truth for multi-agent orchestration.
- Web UI: http://localhost:3008
- API: http://localhost:3333
- State dir: ~/.agency
- MCP entry: hq/backend/dist/mcp-server.js

Host: Codex
Capability level: full
Fallback: Fallback to the generated AGENTS snippet or use the HQ Web UI when host-side instructions are missing.