---
id: 4895f6b7-6634-4b7f-83b5-eaf5f2c76bba
type: failure
executionId: 4895f6b7-6634-4b7f-83b5-eaf5f2c76bba
taskId: 20260327027
agentId: codex
outcome: degraded
status: failed
startedAt: 2026-03-27T05:51:51.249Z
completedAt: 2026-03-27T05:52:23.460Z
duration: 32211
tags:
  - backend_implementation
  - medium
  - degraded
  - codex
  - degraded
---

# Execute a single task

> Execution ID: `4895f6b7-6634-4b7f-83b5-eaf5f2c76bba`
> Task ID: `20260327027`

## Task Description

Run a non-risky task through the lightweight execution service

## Execution Details

- **Status**: failed
- **Executor**: codex
- **Runtime**: local_codex_cli
- **Started**: 2026-03-27T05:51:51.249Z
- **Completed**: 2026-03-27T05:52:23.460Z
- **Mode**: Degraded

## Issues Encountered

- Error: Error executing codex: Command failed: codex exec --ephemeral --json Run a non-risky task through the lightweight execution service

Context:
为任务「Execute a single task」执行步骤 5
2026-03-27T05:51:51.344908Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344929Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344931Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344933Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:51.344934Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/gstack/SKILL.md: invalid description: exceeds maximum length of 1024 characters
2026-03-27T05:51:51.344935Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/architecture/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344936Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/coding/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344938Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344939Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:53.845429Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:54.202066Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.022105Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.360244Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.594033Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:56.671046Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.194966Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.520083Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:58.325044Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.086512Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.410495Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:00.268228Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.252574Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.566236Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:02.370177Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.157086Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.475890Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:05.320090Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:08.853391Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:09.348501Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:10.111249Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses

- Structured error [execution_failed]: Error executing codex: Command failed: codex exec --ephemeral --json Run a non-risky task through the lightweight execution service

Context:
为任务「Execute a single task」执行步骤 5
2026-03-27T05:51:51.344908Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344929Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344931Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344933Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:51.344934Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/gstack/SKILL.md: invalid description: exceeds maximum length of 1024 characters
2026-03-27T05:51:51.344935Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/architecture/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344936Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/coding/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344938Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344939Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:53.845429Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:54.202066Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.022105Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.360244Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.594033Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:56.671046Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.194966Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.520083Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:58.325044Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.086512Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.410495Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:00.268228Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.252574Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.566236Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:02.370177Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.157086Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.475890Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:05.320090Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:08.853391Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:09.348501Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:10.111249Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses

- Execution ran in degraded mode
- Execution ultimately failed

## Result Summary

Error executing codex: Command failed: codex exec --ephemeral --json Run a non-risky task through the lightweight execution service

Context:
为任务「Execute a single task」执行步骤 5
2026-03-27T05:51:51.344908Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344929Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344931Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344933Z ERROR codex_core::codex: failed to load skill /Users/user/.codex/skills/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:51.344934Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/gstack/SKILL.md: invalid description: exceeds maximum length of 1024 characters
2026-03-27T05:51:51.344935Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/architecture/architecture-defense/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344936Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/coding/self-verifying-tests/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 56
2026-03-27T05:51:51.344938Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/entropy-reduction/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 55
2026-03-27T05:51:51.344939Z ERROR codex_core::codex: failed to load skill /Users/user/.agents/skills/refactoring/minimalist-refactorer/SKILL.md: invalid YAML: mapping values are not allowed in this context at line 2 column 49
2026-03-27T05:51:53.845429Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:54.202066Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.022105Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.360244Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:55.594033Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:56.671046Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.194966Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:57.520083Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:58.325044Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.086512Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:51:59.410495Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:00.268228Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.252574Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:01.566236Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:02.370177Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.157086Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:04.475890Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:05.320090Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:08.853391Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:09.348501Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses
2026-03-27T05:52:10.111249Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized, url: wss://open.bigmodel.cn/api/paas/v4/responses


---

*Generated: 2026-03-27T05:52:23.471Z*
*Task Type: backend_implementation*
*Priority: medium*