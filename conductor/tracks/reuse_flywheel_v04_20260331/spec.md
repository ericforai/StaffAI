# Specification: V0.4: Reuse Flywheel & Templates

## Goal
Establish a "Reuse Flywheel" by allowing successful requirement delivery workflows (intents, plans, and squad compositions) to be saved as reusable templates and instantiated with one click.

## Success Criteria
1.  Users can save a completed task or requirement draft as a "Template".
2.  A Template Center allows users to browse, search, and manage saved templates.
3.  New tasks can be created instantly from a template, bypassing the clarification/planning stages if needed.
4.  Templates support dynamic variables (e.g., project name, specific constraints).

## Technical Details
- Backend: Implement `POST /api/tasks/:id/save-template` and `GET /api/templates`.
- Backend: Implement `POST /api/templates/:id/create-task` logic.
- Storage: Persistent storage for `TemplateRecord` objects (JSON/Postgres).
- Frontend: Build the Template Center UI.
- Frontend: Add "Save as Template" button to the Task Detail view.
