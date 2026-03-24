# GEMINI.md

## Project Overview

**The Agency** is a comprehensive collection of 144+ specialized AI agent personalities designed to transform workflows across multiple domains. Unlike generic AI prompts, these agents are meticulously crafted with unique identities, core missions, critical rules, technical deliverables, and success metrics.

The project is organized into 12 divisions, including Engineering, Design, Marketing, Sales, Product, Project Management, Testing, Support, and more. It features a robust integration system that converts these agent definitions into formats compatible with leading AI tools like Claude Code, Cursor, Aider, Windsurf, and **Gemini CLI**.

## Directory Overview

The repository is structured to manage agent definitions and their deployment to various tools:

- **Agent Divisions (`engineering/`, `design/`, `marketing/`, etc.)**: Contain the core `.md` files for each specialized agent.
- **`scripts/`**: Automation tools for maintaining and deploying the agency.
  - `lint-agents.sh`: Validates agent file structure and content.
  - `convert.sh`: Generates tool-specific integration files from the raw agent Markdown.
  - `install.sh`: Deploys the converted agents to local tool configuration directories.
- **`integrations/`**: Target directory for converted files (e.g., Gemini CLI extensions, Cursor rules).
- **`strategy/` & `examples/`**: High-level documentation and real-world multi-agent workflow scenarios.

## Key Commands

### For Maintenance & Development
- **Lint all agents**: Ensure all agent files meet formatting standards.
  ```bash
  ./scripts/lint-agents.sh
  ```
- **Convert agents**: Regenerate integration files for all tools (or a specific one).
  ```bash
  ./scripts/convert.sh --tool gemini-cli
  ```

### For Gemini CLI Integration
- **Install the Agency Extension**: Deploys all agents as skills in your Gemini CLI environment.
  ```bash
  ./scripts/convert.sh --tool gemini-cli
  ./scripts/install.sh --tool gemini-cli
  ```
- **Activate a Skill**: Once installed, you can invoke any agent by its slug.
  ```text
  "Use the frontend-developer skill to review this React component."
  ```

## Development Conventions

When contributing new agents or modifying existing ones, adhere to the following standards enforced by `scripts/lint-agents.sh`:

### Required YAML Frontmatter
Every agent file must begin with a YAML block containing:
- `name`: The human-readable name of the agent.
- `description`: A concise summary of the agent's specialty.
- `color`: A primary color associated with the agent (e.g., cyan, green, red).

### Recommended Sections
To ensure agent quality and personality depth, include these sections:
- `## 🧠 Your Identity & Memory`: Define the persona and background.
- `## 🎯 Your Core Mission`: List primary responsibilities and goals.
- `## 🚨 Critical Rules You Must Follow`: Mandatory boundaries and technical constraints.
- `## 📋 Your Technical Deliverables`: Examples of expected outputs (code, reports).

### Content Quality
- **Word Count**: Agent bodies should generally exceed 50 words to provide sufficient context.
- **Tone**: Maintain the specific "voice" defined in the agent's `communication style` section.
- **Surgical Updates**: When editing, preserve the established frontmatter structure to ensure `convert.sh` continues to function correctly.
