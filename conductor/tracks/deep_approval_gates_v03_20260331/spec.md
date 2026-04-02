# Specification: V0.3: Deep Approval Gates

## Goal
Implement a robust, human-in-the-loop (HITL) approval system that intercepts high-risk agent actions, allows multi-stage plan approvals, and enables automatic resumption of multi-agent workflows after approval.

## Success Criteria
1.  Workflows can be paused at specific steps requiring 'Plan Approval'.
2.  High-risk tool calls (e.g., file deletions, system changes) are automatically intercepted and require explicit approval.
3.  The frontend displays a detailed approval view showing the 'Risk Reason' and 'Blocked Action'.
4.  Workflows automatically resume from the exact point of interruption once approved.
5.  A complete audit trail of approval decisions is maintained and visible.

## Technical Details
- Backend: Extend `ApprovalRecord` to include `approvalType` (plan, tool, delivery) and `blockedAction`.
- Backend: Implement interception logic in `hq/backend/src/governance/approval-service-v2.ts` or tool execution middleware.
- Backend: Ensure `WorkflowExecutionEngine` can be resumed from a `waiting_approval` state.
- Frontend: Create an Approval Detail page/panel.
- Frontend: Integrate approval prompts into the Task Detail view.
