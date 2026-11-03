# AGENTS.md — Guide for AI agents (and human contributors)

## What this is

**vrack2-core is a framework for building event-driven services in Node.js**
(JS/TS) — the *core*, not a finished app. You provide **devices** (classes
extending `Device`) and a **`service.json`** (devices with options + port
connections); the core loads/validates the structure, instantiates devices,
wires ports, runs the lifecycle, moves data, stores state/metrics, and reports
problems as coded errors. Everything external happens **via events**
(`device.render`, `device.error`, `system.error`, …) — subscribe, don't poke internals.

Startup chain: `MainProcess → Bootstrap (boot classes) → ServiceLoader → Container`.
The canonical sequence is documented **only** in `docs/01-Architecture.md`.

## Layout

| Path | What it is |
|---|---|
| `src/` | Framework source (TS strict). **Public API = `src/index.ts`.** Core runtime: `MainProcess`, `Bootstrap`, `ServiceLoader`, `Container`; devices: `service/Device.ts`; plus `ports/`, `actions/`, `metrics/`, `validator/` (`Rule`/`Validator`), `errors/` (`ErrorManager`/`CoreError`). |
| `src/boot/` | Boot classes: `BootClass` base, `DeviceManager`, `DeviceFileStorage`, `StructureStorage`, `ServiceLogger`, `PortLogger`, `BootDatabase` (+ `Sqlite`/`Memory`), `boot/metrics/` (`BootDeviceMetrics`, `JournalDbMetrics`, `VrackDbMetrics`). |
| `test/` | Vitest: `smoke.test.ts` (strict public-API set), `unit/`, `integration/` (real `MainProcess`: service, device-status/-stop, hot-devices, resource-registry, boot-database, loggers), `typing/`, `fixtures/` (test devices & boot classes). |
| `docs/` | Canonical docs, numbered 00–11, one topic per file (map — README). |
| `lib/` | **Build output (CJS + .d.ts), committed (installed from git). Never hand-edit** — `npm run build`. |

Boot classes: `DEFAULT_BOOTLIST` = `DeviceManager` (**required**), `DeviceFileStorage`
(id `DeviceStorage`), `StructureStorage`; opt-in via `bootstrap`: `JournalDbMetrics`
(default metrics engine, `vrack2-journal-db`), `VrackDbMetrics` (`vrack-db`),
`ServiceLogger`, `PortLogger`, `BootDatabaseSqlite`/`Memory` — `docs/07-Bootstrap.md`.

## Commands

`npm test` (all) · `npx vitest run test/unit/validator.test.ts` (one file) ·
`npm run typecheck` + `npm run typecheck:types` · `npm run lint` · `npm run build` (→ `lib/`).

- Tests run **against TS source** via Vitest aliases (`vitest.config.mts`:
  `vrack2-core` → `src/index.ts`, `testkit` → `test/fixtures/boot/index.js`) — no build needed.
- Integration tests use temp dirs under `os.tmpdir()`, clean up after each test.
- Runtime deps: `vrack2-journal-db` (JournalDbMetrics, loggers), `vrack-db` (VrackDbMetrics).

## Rules for changes

1. **Code is the source of truth** — if docs disagree, fix the docs.
2. **Public API = `src/index.ts`**, fully listed (name/purpose/since/deprecated)
   **only** in `docs/11-API.md` and pinned by `test/smoke.test.ts`. Add the table
   row *before* exporting; record deprecations there and in `CHANGELOG.md`; don't
   remove/rename exports without reason.
3. **Internal ≠ public.** Dynamic composition management (`ServiceLoader.addDevice`
   / `removeDevice` / `addConnection`, `Container.startDevice` / `removeDevice` /
   `addConnection`) is `@internal`: code and tests stay, docs must not present it as public.
4. **Errors are coded:** `ErrorManager.make('CODE', data)` with a code registered
   for the module; never bare `Error` for expected failures; unexpected exceptions
   in handlers are wrapped (fail-closed) — let them bubble. Full list — `docs/08-Errors.md`.
5. **Docs: one topic per file.** Startup sequence **only** in `docs/01`, error codes
   **only** in `docs/08`; elsewhere link, don't duplicate.
6. **Never hand-edit `lib/`** — after `src/` changes run `npm run build` (it's committed).
7. **Event-based & testable:** new behavior gets a test (unit/integration split);
   reuse `test/fixtures/devices/testkit/`.
8. **Style:** TS strict; ESLint (`eslint:recommended` + `@typescript-eslint/recommended`);
   match the style of the file you edit.

## Good first moves

- **New device behavior** → extend `testkit` fixtures + `test/integration/service.test.ts`, then implement.
- **New public API** → table in `docs/11-API.md` → export from `src/index.ts` → smoke test → matching `docs/0X`.
- **New error** → `ErrorManager.register` in the owning module → table in `docs/08-Errors.md`.
