# SARProject2

Scaffold project for the SAR course MEAN stack assignment.

This README is the main student entry point. You should be able to start, implement, and validate the project from this page. It also contains the minimum implementation objectives and a list of supplementary features to target for higher grades (17+).

## Navigation

- System architecture reference: [ARCHITECTURE.md](ARCHITECTURE.md)
- Backend development workflow: [Backend/DEVELOPMENT.md](Backend/DEVELOPMENT.md)
- Frontend development workflow: [Frontend/DEVELOPMENT.md](Frontend/DEVELOPMENT.md)

## Project Context

You are developing a real-time auction platform using:

- MongoDB
- Express.js
- Angular
- Node.js
- Socket.IO

The codebase is already scaffolded. Your work is to complete and improve core features following course requirements.

## Learning Goals

By completing this project, students should learn:

1. Full-stack feature implementation across Angular and Express.
2. Type-safe development using TypeScript in frontend and backend.
3. Correct use of JWT authentication and route protection.
4. MongoDB data modeling and CRUD operations with Mongoose.
5. Real-time updates with Socket.IO for auction interactions.
6. Clean modular structure, readability, and maintainability.

## What You Must Implement

Minimum required scope for a passing project:

1. Authentication

- Register and sign in flows.
- JWT issued and validated in protected routes.

2. Auction Item Management

- Create new auction items.
- List active items.
- View item state updates.

3. Bidding Workflow

- Place bids with validation rules.
- Prevent invalid bids (for example lower than current bid).
- Persist bid state in MongoDB.

4. Real-Time Behavior

- Broadcast relevant updates with Socket.IO.
- Keep multiple clients synchronized.

5. Basic Quality and Structure

- Keep frontend logic inside feature and core structure.
- Keep backend concerns separated across routes/controllers/models/services/middlewares.
- Handle expected errors with clear HTTP responses.

## Dev Container Setup (Required)

Use the Dev Container workflow for consistent environments.

1. Clone repository.
2. Open the folder in VS Code.
3. Run command: Dev Containers: Reopen in Container
4. Wait until post-create finishes.

The container provisions dependencies and initial build steps.

## Run the Application

Open two terminals in the container:

1. Backend API

```bash
npm --prefix Backend run dev
```

2. Frontend app

```bash
npm start
```

### After You Change Code

1. If you change backend code in `Backend/src/`, keep `npm --prefix Backend run dev` running. It reloads automatically.
2. If you change frontend code in `Frontend/`, keep `npm start` running. Angular recompiles automatically.
3. You usually do not need to rebuild during development.
4. Restart only when changing dependencies (`package.json`) or startup/environment configuration.

### If Rebuild or Recompile Errors Occur

1. Read the first real error message in the failing terminal. Ignore repeated stack lines at first.
2. If backend failed, restart backend dev server:

```bash
npm --prefix Backend run dev
```

3. If frontend failed, restart frontend dev server:

```bash
npm start
```

4. If you changed dependencies, run `npm install` in the affected project and restart that server.
5. If you changed `.env` or startup configuration, restart both servers.
6. Before submitting, always run checks:

```bash
npm --prefix Backend run lint
npm --prefix Backend run build
npm test
```

Application endpoints:

- Main app URL (recommended): https://localhost:3043
- HTTP redirect entry point: http://localhost:3000
- Frontend dev server (optional): http://localhost:4200

### What Each Application Endpoint Is For

1. Backend HTTPS (`https://localhost:3043`)

- This is the main URL students should open in the browser.
- The backend serves the Angular app from `dist/auction-sar` when available.

2. Backend HTTP (`http://localhost:3000`)

- Redirect entry point to HTTPS.
- You can open it, but it will redirect to `https://localhost:3043`.

3. Frontend dev server (`http://localhost:4200`)

- Optional URL used only if you specifically run Angular dev-server workflows.
- Not required for normal student usage in this project setup.

In normal development for this project, open `https://localhost:3043`.

## Recommended Delivery Checklist

Before submission, verify:

1. App starts in Dev Container without manual local dependency setup.
2. Authentication works for protected API endpoints.
3. Item creation and listing works end-to-end.
4. Bids update correctly in database and in real time.
5. No breaking runtime errors in normal user flows.
6. Code is organized according to the provided architecture.

## Optional Bonus Features (Target Grade > 17)

Choose one or more features below to target higher grades:

1. Advanced Auction Mechanics

- Automatic auction close with winner resolution.
- Soft-close extension when bids arrive in final seconds.

2. Notifications and User Experience

- In-app notifications for outbid, win, and auction ending soon.
- Email notification integration for key events.

3. Search and Filtering

- Filter by price range, status, owner, and remaining time.
- Text search on item description and tags.

4. Admin and Moderation

- Admin role to remove invalid items and block abusive users.
- Audit log for moderation actions.

5. Reliability and Security Hardening

- Request validation middleware for all write endpoints.
- Rate limiting and improved security headers.

6. Observability and Testing

- Add unit tests for key services and controllers.
- Add end-to-end scenario tests for core user flows.
- Add structured logging and basic health checks.

## Bonus Evaluation Guidance

For bonus features to count positively, they should be:

1. Functionally complete (not partial mockups).
2. Integrated with current architecture.
3. Demonstrated with a short walkthrough.
4. Stable under typical usage.
5. Accompanied by at least basic tests or validation evidence.
