"""
TaskEnvelope v2 Protocol - Python Side

Unified envelope for dual-core communication between
TypeScript Office (HQ backend) and Python Workshop (DeerFlow).

Field groups match the TypeScript definition in:
  hq/backend/src/shared/task-envelope-v2.ts
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Field Group Models
# ============================================================================


class TaskMetadataGroup(BaseModel):
    """Core task identity – TS truth-source."""

    task_id: str
    title: str
    description: str
    task_type: str = "general"
    priority: str = "medium"
    execution_mode: str = "single"
    requested_by: str = "system"
    requested_at: str = ""


class RoutingGroup(BaseModel):
    """Routing and assignment info – TS truth-source."""

    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    recommended_agent_role: str = "dispatcher"
    candidate_agent_roles: list[str] = Field(default_factory=lambda: ["dispatcher"])
    route_reason: str = ""


class ApprovalContextGroup(BaseModel):
    """Risk and approval state – TS truth-source."""

    approval_required: bool = False
    risk_level: str = "low"
    approval_id: Optional[str] = None


class MemoryLayerHints(BaseModel):
    """Workshop read-only - hints for which memory layers to load."""

    prefer_l1: Optional[bool] = None
    prefer_l2: Optional[bool] = None
    prefer_l3: Optional[bool] = None


class MemoryContextGroup(BaseModel):
    """Memory loading hints – TS truth-source, Workshop read-only consumption."""

    profile_excerpt: Optional[str] = None
    layer_hints: Optional[MemoryLayerHints] = None


class BudgetControlGroup(BaseModel):
    """Execution budget control – TS truth-source."""

    timeout_ms: Optional[int] = None
    max_retries: Optional[int] = None
    max_tokens: Optional[int] = None


class ToolPolicyGroup(BaseModel):
    """Tool access policy – TS truth-source."""

    allowed_tools: Optional[list[str]] = None
    blocked_tools: Optional[list[str]] = None
    risk_threshold: Optional[str] = None


class CheckpointGroup(BaseModel):
    """State persistence references – TS truth-source."""

    checkpoint_ref: Optional[str] = None
    thread_id: Optional[str] = None
    parent_execution_id: Optional[str] = None


class SessionCapabilities(BaseModel):
    """Session capability flags."""

    sampling: bool = False


class RuntimeControlGroup(BaseModel):
    """Runtime and executor metadata – TS truth-source, Workshop read-only."""

    executor: str = "deerflow"
    degraded: Optional[bool] = None
    runtime_name: Optional[str] = None
    session_capabilities: Optional[SessionCapabilities] = None


# ============================================================================
# TaskEnvelope v2
# ============================================================================

TASK_ENVELOPE_V2_VERSION: Literal["2.0"] = "2.0"


class TaskEnvelopeV2(BaseModel):
    """
    TaskEnvelope v2 – the unified dual-core protocol envelope.

    Carries all context needed for the Workshop to execute a task,
    including routing, approval state, memory hints, budget, and checkpoint refs.
    """

    version: Literal["2.0"] = TASK_ENVELOPE_V2_VERSION
    task_metadata: TaskMetadataGroup
    routing: RoutingGroup = Field(default_factory=RoutingGroup)
    approval_context: ApprovalContextGroup = Field(default_factory=ApprovalContextGroup)
    memory_context: MemoryContextGroup = Field(default_factory=MemoryContextGroup)
    budget_control: BudgetControlGroup = Field(default_factory=BudgetControlGroup)
    tool_policy: ToolPolicyGroup = Field(default_factory=ToolPolicyGroup)
    checkpoint: CheckpointGroup = Field(default_factory=CheckpointGroup)
    runtime_control: RuntimeControlGroup = Field(default_factory=RuntimeControlGroup)

    @classmethod
    def from_v1_envelope(cls, v1: dict[str, Any]) -> TaskEnvelopeV2:
        """
        Create a v2 envelope from a legacy v1 envelope.

        v1 fields: task_id, action, agent_role, identity_context,
                   description, memory_context, payload
        """
        return cls(
            task_metadata=TaskMetadataGroup(
                task_id=v1.get("task_id", ""),
                title=v1.get("action", ""),
                description=v1.get("description", ""),
                task_type="general",
                priority="medium",
                execution_mode="single",
                requested_by="system",
                requested_at="",
            ),
            routing=RoutingGroup(
                recommended_agent_role=v1.get("agent_role", "dispatcher"),
                candidate_agent_roles=[v1.get("agent_role", "dispatcher")],
                route_reason="Migrated from v1 envelope",
            ),
            approval_context=ApprovalContextGroup(
                approval_required=False,
                risk_level="low",
            ),
            memory_context=MemoryContextGroup(
                profile_excerpt=v1.get("memory_context"),
            ),
            runtime_control=RuntimeControlGroup(
                executor="deerflow",
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict suitable for JSON."""
        return self.model_dump(mode="json")
