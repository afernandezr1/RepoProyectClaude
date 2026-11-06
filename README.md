# Steady Log

A personal, local-first workout and wellbeing log, meant as a replacement for Strong Pro. You can log workouts from templates with sets and rest timers, plan a moderate week with rest days, keep optional logs of activity, sleep, mood, energy and notes, and see weekly patterns described in neutral language.

Built with **React Native + Expo (SDK 58) + TypeScript + SQLite**. Apple Health / Health Connect support is included but **off unless you enable it**.

> **Not medical care.** Steady Log is a personal logbook. It does not diagnose, treat or monitor any condition, and it does not replace advice from a doctor, physiotherapist or other qualified professional. If you have health concerns, pain, or questions about what exercise is right for you, talk to a qualified professional. The app shows this statement on first run and on the *About & safety* screen.

---

## Quick start (one command)

Requirements: Node.js 20 or newer and npm. For a phone, install **Expo Go**. For a simulator, install Xcode or Android Studio.

```bash
npm run first-run
```

This command:
1. copies `.env.example` to `.env` if `.env` is missing (it never overwrites an existing one),
2. installs dependencies if `node_modules` is missing (`npm ci`),
3. starts the Expo dev server.

Then scan the QR code with Expo Go, or press `i` for the iOS simulator, `a` for the Android emulator, or `w` for web. You don't need an account, a sign-in or network services. After the first run, `npm start` is enough.

| Command | What it does |
|---|---|
| `npm run first-run` | One-time setup and start (above) |
| `npm start` / `npm run ios` / `npm run android` / `npm run web` | Start the dev server |
| `npm test` | Unit tests plus the end-to-end happy path (Jest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`expo lint`, eslint-config-expo) |
| `npm run check` | Typecheck, lint and tests |
| `npm run build:dev:ios` / `npm run build:dev:android` | Local development build (`expo run:*`), needed only for health integration |
| `npm run e2e:web` | Optional browser smoke test of the UI (see [Tests](#tests)) |

## Features

- **Workouts:** start from a template or start empty. Log weight × reps, reps, time or distance per set. Sets pre-fill from your last completed values. Add or remove sets and exercises mid-workout, and add notes. Unchecked sets are dropped when you finish.
- **Rest timer:** starts automatically when you complete a set, using that exercise's rest time. You can use −15s/+15s, pause/resume and skip. It counts from wall-clock time, so it stays correct when the app is backgrounded, and it vibrates when done.
- **Templates:** create, edit, reorder and delete them. Two moderate starter templates are included. You can add custom exercises.
- **Weekly routine:** mark each weekday as workout (optionally tied to a template), rest or open. The default week has three workout days and three rest days. Suggestions are gentle and never block anything.
- **Optional logs:** activity, sleep, mood, energy and personal notes. Units are editable (minutes/hours, 1–5/1–10 scales, kg/lb, km/mi). Each entry keeps the unit it was entered in and is converted only for display.
- **Patterns:** a 4/8/12-week view of active days, sessions by weekday, volume, logged activity, sleep, mood and energy, plus per-exercise trends. Wording is neutral: no "missed", no streaks, no targets, no body or diagnostic judgements. A test enforces a blocklist of judgmental words.
- **Reminders:** local weekly notifications that you can mute with one switch. Muting keeps your reminders. There's no push service.
- **Your data:** JSON backup export and restore, CSV export, a view of where data lives, and full deletion.
- **States:** every screen has loading, empty, success and recoverable error states (*"Try again"*; "your saved data is unchanged").

## Architecture

```
src/
  app/                    expo-router screens (file = route)
    (tabs)/               Today · History · Patterns · Logs · Settings
    workout/[id].tsx      active workout + rest timer
    history/[id].tsx      finished workout details
    templates/            list + editor
    routine.tsx  log-new.tsx  reminders.tsx  data.tsx  about.tsx  welcome.tsx
  domain/                 pure TypeScript — no React Native imports, fully unit-testable
    trends.ts             core transformation: history -> weekly patterns + neutral text
    units.ts              kg/lb, km/mi, min/h, rating-scale conversion
    validation.ts         all user-input validation (Result types, never throws)
    backup.ts             export format, restore validation, CSV (formula-injection safe)
    filenames.ts          safe export filenames
    timer.ts              rest timer state machine
    health.ts             shaping health-platform samples into local logs
    routine.ts            default week, starter templates, gentle suggestions
  db/
    schema.ts             migrations (PRAGMA user_version)
    store.ts              every SQL statement; screens only see domain types
    expoDb.ts             expo-sqlite adapter
  services/
    notifications.ts      local reminders (graceful on web / denied)
    files.ts              write export -> share sheet; pick backup file
    health/               index.ts (fallback), index.ios.ts (HealthKit), index.android.ts (Health Connect)
  state/AppContext.tsx    opens DB, provides Store + settings, useLoad() hook
  components/             UI kit, state views, rest timer bar, bar charts
test/                     Jest tests (sql.js adapter runs the real SQL in Node)
```

The design is a thin UI over a pure domain layer and a single `Store` class. The `Store` talks to a 5-method `Db` interface. In the app that interface is backed by **expo-sqlite**. In tests it's backed by **sql.js**, which is real SQLite compiled to WebAssembly. Tests therefore run the same migrations and SQL as the device.

**Data model (SQLite):** `exercises`, `templates`, `template_exercises`, `workouts`, `workout_sets`, `log_entries`, `routine_days`, `reminders`, `settings`, `meta`. Weights are stored in kg and distances in metres. Log values keep their entered unit.

**What's not here, on purpose:** accounts, sign-in, billing, telemetry, analytics, crash reporting, remote config, any hosted backend, social features, wearables, human coaching, medical diagnosis or treatment, weight-loss targets, calorie or diet coaching, and extreme-training programs. The app makes no network requests of its own.

## Permissions

The app asks only when a feature needs it, and everything works if you say no.

| Permission | When it's requested | If declined |
|---|---|---|
| Notifications | When you add or enable a reminder | Reminders are saved but don't appear; the screen says so |
| Health: **Sleep** (read) | When you turn on *Settings › Health platform › Sleep* | Sleep logging stays manual |
| Health: **Workouts** (read) | When you turn on *Settings › Health platform › Workouts* | Activity logging stays manual |
| File picker / share sheet | When you export or restore | Exports are still saved in the app's documents folder |

- Health access is **per data type**: each toggle asks for exactly one permission. Access is **read-only**. The app declares no write permission and never writes to Apple Health or Health Connect.
- HealthKit never tells apps whether *read* access was granted, so the app reports "connected" and imports whatever the platform returns. Health Connect reports grants exactly.
- Turning a toggle off stops importing. To revoke access at the OS level, go to Health app › Profile › Apps, or Health Connect › App permissions.

### Health integration (opt-in)

Health libraries can't run in Expo Go, so this needs a development build:

1. In `.env`, set `EXPO_PUBLIC_HEALTH_ENABLED=true`.
2. Build and run on a device or simulator: `npm run build:dev:ios` or `npm run build:dev:android`. Android needs the Health Connect app on Android 13 or earlier; it's built into Android 14+.
3. In the app, go to *Settings › Health platform* and turn on Sleep and/or Workouts.

With the flag off (the default), `app.config.ts` adds **no** HealthKit entitlement, **no** Health Connect permissions and **no** health plugins. The health code paths return "unavailable", and the UI explains that health import is off. If the flag is on but the native module is missing, as in Expo Go, the adapters catch the failure and report "unavailable".

## Where your data lives

Everything stays on the device in one SQLite database, `steady-log.db`:

| Platform | Location |
|---|---|
| iOS | app sandbox › `Documents/SQLite/steady-log.db` |
| Android | `/data/data/app.steadylog.local/files/SQLite/steady-log.db` (app-private) |
| Expo Go | inside Expo Go's sandbox for this project |
| Web | the browser's Origin Private File System for the site |

Exports are written to `<app documents>/exports/`. The exact database path and exports folder are shown in the app under **Settings › Export, restore or delete data**.

## Backup and restore

1. **Back up:** go to *Settings › Export, restore or delete data › Export full backup (JSON)*. The share sheet opens, and you can save the file to Files, iCloud Drive, Google Drive, a computer or anywhere else you choose. Filenames are sanitised and timestamped, for example `steady-log-backup-20251113-090507.json`.
2. **Spreadsheet copy (optional):** *Export sets & logs (CSV)* writes `steady-log-sets-….csv` and `steady-log-logs-….csv`, in your display units.
3. **Restore:** *Restore from backup* lets you pick the JSON file. The app validates it first: format, version, field types and references. It then shows what's in the file and asks before replacing anything. The import runs in a single transaction, so a failure leaves your current data untouched.
4. **Moving to a new phone:** export on the old phone, move the file, install the app on the new phone and restore.

The app has no cloud sync. The JSON export is the supported backup.

## Full deletion

Go to *Settings › Export, restore or delete data › Delete all data* and confirm twice. This:
- deletes every row in every table, then runs `VACUUM`,
- cancels all scheduled reminders,
- removes the app's `exports/` folder,
- returns the app to a fresh install (built-in exercises, starter templates, default routine and default settings) and shows the welcome screen again.

Data in Apple Health or Health Connect is never touched. Uninstalling the app also removes the database.

## Secrets and configuration

- The app needs **no secrets**.
- `.env` is git-ignored. `.env.example` is the committed template, and `npm run first-run` creates `.env` from it.
- `EXPO_PUBLIC_*` variables are built into the app bundle, so they are **not** secret. Use them only for flags like `EXPO_PUBLIC_HEALTH_ENABLED`.
- If you add a credential for your own tooling (for example an `EXPO_TOKEN` for cloud builds), keep it in `.env` and never commit it.

## Tests

```bash
npm test
```

- `test/trends.test.ts` covers the core transformation. It checks Monday-based week bucketing, that in-progress and uncompleted work is excluded, unit conversion (lb, minutes↔hours, 1–5↔1–10), that unknown units are skipped instead of guessed, weekday patterns, consistency, per-exercise trends, and that observations contain no judgmental words.
- `test/domain.test.ts` covers units, input validation, the rest timer, safe filenames, the backup round-trip and rejection cases, CSV escaping and formula-injection protection, and health sample merging.
- `test/happyPath.e2e.test.ts` runs the **end-to-end happy path** on real SQLite (sql.js): first run → start a template workout → log sets in lb with rest timer → finish → history → pre-fill on next workout → wellbeing logs → patterns → export JSON/CSV → full deletion → restore from the export. It also checks that a failed restore rolls back and keeps existing data.
- `e2e/web-happy-path.cjs` (optional, not part of `npm test`) drives the real UI in Chromium. It goes through welcome, the disclaimer, starting a template, completing a set with the rest timer, a validation error, finishing, history, patterns, adding a sleep log with validation, the JSON export download and full deletion. To run it, start `npm run web` in one terminal, then run `npm run e2e:web` in another. It needs the `playwright` package and a Chromium browser.

Tests pin `TZ=UTC` (`test/setupTz.js`) so week boundaries are deterministic.

## Troubleshooting

- **"The local database could not be opened"**: tap *Try again*. If it keeps failing, restart the app. Your data is not deleted.
- **Reminders don't appear**: check that they're not muted in Settings and that notifications are allowed for the app (or Expo Go) in system settings. Reminders don't work on web.
- **Health toggles are missing**: check that the build has `EXPO_PUBLIC_HEALTH_ENABLED=true` and that you're running a development build, not Expo Go.
- **Web:** `metro.config.js` sends cross-origin-isolation headers and serves `.wasm` so expo-sqlite can run in the browser.
