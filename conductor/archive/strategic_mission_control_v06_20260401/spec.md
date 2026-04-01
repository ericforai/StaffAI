# Specification: V0.6: Strategic Mission Control (OKR & Goals)

## Goal
Transform the "Tower" view from a simple monitoring dashboard into a strategic decision center. Implement a full OKR (Objectives and Key Results) management system that drives autonomous agent behavior and provides users with a way to set long-term organizational goals.

## Success Criteria
1.  Users can create, view, and edit OKRs directly from the Tower UI.
2.  Key Results (KRs) are linked to system metrics where applicable (e.g., success rate, task count).
3.  The Tower view supports Tabbing between "Dashboard" (Real-time monitoring) and "OKR & Goals" (Strategy management).
4.  Proactive agent proposals (Intents) are visually linked to the OKRs they intend to address.

## Technical Details
- Backend: Implement RESTful API for OKRs (`GET`, `POST`, `PATCH`, `DELETE`).
- Backend: Ensure `InspectorService` correctly evaluates the current values of KRs.
- Frontend: Refactor `hq/frontend/src/app/tower/page.tsx` into a tabbed layout.
- Frontend: Create `OKRList` and `OKRForm` components.
- Domain: Sync `KeyResult` status with the `InspectorService` gap analysis logic.
