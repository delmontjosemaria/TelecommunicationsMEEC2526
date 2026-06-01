# Frontend Development Guide

## 1. Scope

This guide covers frontend development tasks only:

- adding/updating components, services, and routing
- integrating frontend calls with backend APIs
- validating frontend changes before commit

Architecture rationale and system-level design live in `../ARCHITECTURE.md`.

## 2. Frontend Folder Responsibilities

- `Frontend/app/core/`: singleton services, models, guards
- `Frontend/app/features/`: feature modules and feature components
- `Frontend/app/shared/`: reusable UI elements and shared module pieces
- `Frontend/app/material/`: Angular Material aggregation module
- `Frontend/environments/`: environment-specific frontend settings

## 3. Change Playbooks

### 3.1 Add a New UI Feature

1. Create/update a feature module under `Frontend/app/features/`.
2. Add component files and template/style files.
3. Add route entries if navigation is needed.
4. Wire backend calls through a service in `core/services` or feature scope.
5. Add/update unit tests for the new behavior.

### 3.2 Add a New API Call

1. Add typed request/response handling in the relevant Angular service.
2. Keep HTTP concerns in services, not components.
3. Update models/interfaces if payload shape changed.
4. Surface user-friendly UI messages for loading/error states.

### 3.3 Update Auth/Guard Behavior

1. Update auth service token/session logic.
2. Update route guards for access control changes.
3. Verify redirect behavior on expired/invalid auth.
4. Re-test feature routes that require authentication.

## 4. Frontend Testing Notes

- Spec files are under `Frontend/**/*.spec.ts`.
- The test TypeScript config is `tsconfig.spec.json`.
- Keep component tests focused on behavior and rendering outcomes.

## 5. UI and Code Quality Checklist Before Commit

1. Components avoid direct backend logic; services own API interaction.
2. Forms and user inputs are validated in the UI.
3. No hardcoded secrets, tokens, or environment-specific URLs.

## 7. Common Student Pitfalls

1. Making HTTP calls directly inside templates or complex component lifecycle blocks.
2. Mixing too much state logic into a single component.
3. Not unsubscribing or managing long-lived subscriptions.
4. Forgetting to update TypeScript models when API payloads change.
5. Shipping UI changes without verifying error and empty states.
