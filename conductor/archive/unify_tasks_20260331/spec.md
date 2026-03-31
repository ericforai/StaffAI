# Track Specification: unify_tasks_20260331

## Title
Unify /tasks and /tasks/new pages into a single view

## Goal
Combine the task creation and task list pages into a single, cohesive user experience.

## Background
Currently, task creation is handled on a separate page (`/tasks/new`), and the list of existing tasks is on `/tasks`. This separation creates unnecessary navigation steps and disjointed context for the user.

## High-Level Requirements
- **Single Page View**: Integrate the task creation form directly into the main task list page.
- **Improved UX**: Users should be able to see their existing tasks while creating a new one.
- **Consistency**: Maintain a unified visual style and behavior across the consolidated view.

## Tech Stack
- **Frontend**: React 19, Next.js, TailwindCSS.

## Success Criteria
1.  **Unified Layout**: Task creation and task list are visible on the same page.
2.  **Functionality**: Users can successfully create new tasks and see them appear in the list without full page reloads.
3.  **Redirection**: Accessing `/tasks/new` should ideally redirect to the unified view or be deprecated in favor of the single page.
