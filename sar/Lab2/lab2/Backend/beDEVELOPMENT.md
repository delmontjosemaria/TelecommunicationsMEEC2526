# Backend Development Guide (Student Workflow)

## 1. Use This Daily Workflow

Open 2 terminals from project root:

1. Backend:
   ```bash
   npm --prefix Backend run dev
   ```
2. Frontend:
   ```bash
   npm start
   ```

Keep both terminals running while you develop.

## 2. What Happens After Code Changes

1. If you change backend code in `Backend/src/`:

- No rebuild needed.
- The backend reloads automatically because `npm --prefix Backend run dev` is in watch mode.

2. If you change frontend code in `Frontend/`:

- No rebuild needed.
- Angular recompiles automatically while `npm start` is running.

3. After changes, refresh the browser and test the flow you edited.

## 3. When You Must Restart

Restart backend if you changed:

- `Backend/package.json` (after running `npm install`)
- `.env` values
- backend startup/config files

Restart frontend if you changed:

- root/frontend dependency setup (`package.json`)
- Angular startup/build configuration

## 4. Before Submission

Run these checks:

```bash
npm --prefix Backend run lint
npm --prefix Backend run build
npm test
```

Then validate end-to-end behavior in the browser.

## 5. Important Rule

During development, do not run `npm --prefix Backend run start`.
Use `npm --prefix Backend run dev` so backend changes are picked up automatically.
