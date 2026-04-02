# Implementation Plan: reuse_flywheel_v04_20260331

## Title
V0.4: Reuse Flywheel & Templates

---

## Phase 1: Template Persistence & API [checkpoint: ]

- [x] Task: Define Template Schema and Domain Types
    - [x] Create `TemplateRecord` interface in `hq/backend/src/shared/intent-types.ts`
- [x] Task: Implement Template Storage and Retrieval
    - [x] Update `Store` to support `saveTemplate`, `getTemplates`, `getTemplateById`
- [x] Task: Backend API for Templates
    - [x] Implement `POST /api/tasks/:id/save-template`
    - [x] Implement `GET /api/templates`


---

## Phase 2: Template Center UI [checkpoint: ]

- [x] Task: Build Template Center Page
    - [x] List saved templates with search and filtering
    - [x] Detail view for templates (showing scenario tags)
- [x] Task: Integrate "Save as Template" Action
    - [x] Add button/modal in Task Detail page to trigger template creation

---

## Phase 3: One-Click Instantiation [checkpoint: ]

- [x] Task: Template to Task Conversion Logic
    - [x] Implement `POST /api/templates/:id/create-task` creating ready intents
    - [x] Integrate URL-based intent loading in Advanced Wizard
- [x] Task: End-to-end verification
    - [x] Complete a task -> Save as Template -> Create new task from Template -> Verify squad and plan match
