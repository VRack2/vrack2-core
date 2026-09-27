# Testing

Local test tooling is based on **Vitest**. Tests run directly against the
TypeScript sources via the `vrack2-core` alias (`src/index.ts`) and the
`testkit` alias (`test/fixtures/boot/index.js`), so no build step is required
before running tests.

## Commands

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `npm test`         | Run the full test suite once (unit + integration)  |
| `npm run test:watch` | Run tests in watch mode (re-run on change)       |
| `npm run typecheck`| TypeScript type check (`tsc --noEmit`)             |
| `npm run typecheck:types` | Type-level tests against the public API typing (subclass typed `shares` fields; unknown keys / wrong types are compile errors) |
| `npm run lint`     | ESLint over the repository                          |
| `npm run build`    | Compile the library to `lib/` (CommonJS)           |

Run a single file:

```bash
npx vitest run test/unit/validator.test.ts
```

## Test layout

- `test/smoke.test.ts` — public API surface of the `vrack2-core` entrypoint.
- `test/typing/device-shares.ts` — type-level fixture for typed `Device.shares` (subclass fields
  with declared shapes); compiled by `npm run typecheck:types`, not executed.
- `test/unit/` — unit tests: `ErrorManager`/`CoreError` (errors),
  error-code ↔ docs/08-Errors.md sync (error-docs), `Rule`/`Validator`,
  ports, `ReactiveRef`, `ImportManager`, `mergeBootList` (layered boot-list
  merge), typed `Device.shares`, `BootDatabase` base class with a fake
  adapter, `BootDatabaseSqlite`/`BootDatabaseMemory` against the real
  `node:sqlite` driver.
- `test/integration/service.test.ts` — boots a real `MainProcess`
  (Bootstrap → boot classes → Container → devices/ports) using the `testkit`
  fixture vendor and covers layered boot-list config, device registration,
  options validation, port connections, device input/action/output/metric
  behavior, metric storage through in-memory `vrack-db`, structure and
  device storage persistence, `MainProcess.terminate()` and
  `Bootstrap.terminateAll()`.
- `test/integration/device-status.test.ts` — the `device.status` channel:
  initial status, lifecycle transitions, alert/error tracking, removal.
- `test/integration/device-stop.test.ts` — `Container.stopDevice()` /
  `stopAll()`, stopped-device behavior, restart.
- `test/integration/hot-devices.test.ts` — hot add/remove of devices and
  connections in a running service.
- `test/integration/boot-database.test.ts` — a service with a file-backed /
  in-memory SQLite database: start, fail-fast on connect faults, terminate.
- `test/fixtures/boot/index.js` — boot-class fixtures (`GoodBoot`,
  `NotABoot`, `OptionsBoot`, `DefaultBoot`, `TermBoot`, `FailTermBoot`).
- `test/fixtures/devices/testkit/` — fixture devices (`Counter`, `DbReader`,
  `Lamp`, `NoHandler`, `ReturnSrc`, `SharesField`, `StopFail`, `Tracker`)
  with `list.json`.

Integration tests create their temporary storage/structure directories under
`os.tmpdir()` and clean them up after each test.