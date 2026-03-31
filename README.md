# 🎭 StaffAI Agent OS

> **The Enterprise-Grade AI Agent Operating System** - A dual-core architecture designed for reliable, scalable, and governed multi-agent orchestration.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![StaffAI 1.0](https://img.shields.io/badge/Version-1.0--Stable-blue.svg)](#-key-features-staffai-10)

---

## 🚀 Overview

**StaffAI Agent OS** is a comprehensive platform for deploying and managing specialized AI agent teams. Unlike generic prompt libraries, StaffAI provides a robust physical and logical runtime environment where agents collaborate under enterprise governance.

### 🏗️ Dual-Core Architecture

The system operates on a high-performance dual-core design:

1.  **TS Office (The Orchestrator)**: A TypeScript-based backend (`hq/`) managing workflow planning, task routing, approval chains, and persistent state.
2.  **Python Workshop (The Executor)**: A Python-based environment (`workshop/` using `deer-flow`) optimized for high-performance tool execution, data processing, and complex agentic reasoning.

---

## ✨ Key Features (StaffAI 1.0)

Our 1.0 release closes the critical engineering gaps for production readiness:

- **🏛️ Enterprise Governance**: Multi-step **Approval Chains** with persistent Repository patterns. Risk-based routing ensures high-stakes tasks are reviewed by the right roles (Team Lead, Manager, Compliance).
- **💰 Precision Budgeting**: Singleton-based **Budget Tracking** with automatic shutoff and circuit breakers. Real-time cost accumulation across complex, multi-step workflows.
- **🧠 Tiered Memory Hierarchy**: 
  - **L1 (Organization)**: Shared company knowledge and global decisions.
  - **L2 (Project)**: Shared project-specific context and task summaries.
  - **L3 (Agent)**: Private agent experience and specialized learning.
- **🛡️ Self-Healing Workflows**: Intelligent retry logic with automatic agent replacement and checkpoint-based recovery.
- **🤝 HITL (Human-in-the-Loop)**: Advanced recovery APIs allowing manual intervention, pausing, and resuming workflows from any point.

---

## ⚡ Quick Start

### 🏁 Bootstrap the OS

```bash
# Initialize the HQ (TS Office)
cd hq && ./setup.sh
./start.sh

# The Python Workshop (deer-flow) will be automatically connected
```

Then open:
- `http://localhost:3008` for the **Command Deck**
- `http://localhost:3333/startup-check` for runtime status

---

## 🔌 Multi-Tool Integrations

StaffAI agents are designed to follow you into your favorite IDEs and CLI tools. We support native integrations for:

- **[Claude Code](https://claude.ai/code)**: Native `.md` agents support.
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)**: Full extension support with agent-specific skills.
- **[Cursor](https://cursor.sh)** / **[Windsurf](https://codeium.com/windsurf)**: Automated `.mdc` rule generation.
- **[GitHub Copilot](https://github.com/copilot)** / **[Aider](https://aider.chat)**: Standardized convention injection.

```bash
# Generate integration files for all tools
./scripts/convert.sh

# Install to your local environment
./scripts/install.sh --tool gemini-cli
```

---

## 🎨 The Agency Roster

StaffAI comes pre-loaded with **144+ specialized agent personalities** across 12 divisions:

- **💻 Engineering**: Architects, DevOps, SREs, Security Engineers.
- **🎨 Design**: UI/UX Designers, Brand Guardians, Whimsy Injectors.
- **📢 Marketing**: SEO Specialists, Growth Hackers, Social Media Strategists.
- **💼 Sales**: Deal Strategists, Discovery Coaches, Outbound Experts.
- **📊 Product**: Sprint Prioritizers, Trend Researchers.
- **...and more**: Specialized specialists for every corporate function.

[Browse the full Agent Directory](AGENTS.md)

---

## 📖 Design Philosophy

1.  **🎭 Identity First**: Agents have unique voices, constraints, and success metrics.
2.  **📋 Deliverable Focused**: Every agent is optimized to produce concrete artifacts, not just chat.
3.  **🔄 Process Driven**: Built-in workflows (Plan -> Act -> Validate) ensure consistency.
4.  **⚖️ Governed**: Physical connectivity is bound by budget and approval guardrails.

---

## 🤝 Contributing

We welcome contributions to the StaffAI ecosystem!
- **Add Agents**: Submit new agent definitions in the division folders.
- **Improve Runtimes**: Enhance the TS Office or Python Workshop capabilities.
- **Localization**: Help us bring StaffAI to more regions.

[Contributing Guidelines](CONTRIBUTING.md)

---

<div align="center">

**🎭 StaffAI Agent OS: Your Digital Workforce Awaits 🎭**

Made with ❤️ for the future of work

</div>
