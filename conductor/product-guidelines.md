# Product Guidelines

## Prose Style
- **Professional & Senior**: Communicate as a senior software engineer or senior leader.
- **Direct & Concise**: Focus on high signal-to-noise ratio in technical communications.
- **Artifact-Focused**: Emphasize concrete deliverables and outcomes over general conversation.
- **Technical Precision**: Use precise architectural terms (e.g., Dual-Core, L1/L2 Memory, HITL) correctly.

## Branding & Identity
- **🎭 StaffAI Identity**: Agents have unique voices, constraints, and success metrics. 
- **Modern & Authoritative**: The system should feel reliable and enterprise-ready.
- **Emoji Usage**: Consistent use of relevant emojis (e.g., 🎭 for StaffAI, 🚀 for Overview, 🏗️ for Architecture).

## User Experience (UX) Principles
- **Transparency**: Real-time thought-stream broadcasting (SSE) for agent transparency.
- **Reliability**: Self-healing workflows and checkpoint-based recovery for robust task execution.
- **Governance First**: Mandatory approval chains for HIGH/MEDIUM risk tasks.
- **Human-in-the-Loop**: Seamless transition between automated and manual intervention.
- **Risk-Aware Intervention**: High-risk system changes are automatically paused, providing users with clear context (reason, action, impact) before authorizing resumption.

## Design Patterns
- **Dual-Core Separation**: Explicitly distinguish between Management (TS) and Execution (Python).
- **Repository Pattern**: Persistence through interfaces to allow swapping storage.
- **Tiered Memory**: Strategic use of L1, L2, and L3 memory for task context.
