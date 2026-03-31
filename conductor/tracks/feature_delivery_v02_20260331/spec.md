# Specification: V0.2: Feature Delivery & Teaming

## Goal
Implement the transition from RequirementDraft (Intent) to TaskRecord (Task), enabling automated teaming and workflow activation for the "feature-delivery" preset.

## Success Criteria
1.  RequirementDraft can be converted into a TaskRecord via a new API endpoint.
2.  The `feature-delivery` preset is correctly activated upon task creation.
3.  The task detail view in the frontend displays the Implementation Plan and structured artifacts from each role.
4.  The system correctly routes tasks through the sequence: PM -> Architect -> Frontend -> Backend -> Security -> Reviewer.

## Technical Details
- Backend: Update `hq/backend/src/api/intents.ts` to implement `/api/intents/:id/create-task`.
- Backend: Implement conversion logic in `hq/backend/src/orchestration/task-orchestrator.ts`.
- Frontend: Enhance task detail view to include Plan and Artifacts tabs.
- Domain: Ensure `TaskRecord` stores the reference to its originating `RequirementDraft`.
