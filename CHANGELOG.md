# Changelog

## 2026.09.13

### Major

- Реверсивная остановка устройств: `Container.stopDevice(id)` / `Container.stopAll()`, хуки устройства `Device.stop()` / `Device.stopPromise()`. Остановка обратима: повторный запуск — `Container.startDevice()` (повторно выполняются `process()` + `processPromise()`, снова включаются порты и actions).
- Убран `Device.works`: его заменило `Device.running` — состояние работы, которым **управляет контейнер** (`startDevice()` / `runProcess()` → `true`, `stopDevice()` / `stopAll()` → `false`).
- Остановленное устройство не принимает данные портов (`push` отбрасывается), а его actions отклоняются ошибкой `CTR_DEVICE_STOPPED`.
- `Container.removeDevice()` и `ServiceLoader.removeDevice()` теперь асинхронные (возвращают `Promise`): работающее устройство сначала останавливается (`stop()` + `stopPromise()`), и только потом вызывается `beforeTerminate()`. Падение хуков остановки прерывает удаление (fail-closed) — устройство остаётся в контейнере.
- Добавлен `MainProcess.terminate()` — graceful-завершение сервиса: останавливает все работающие устройства (через `Container.stopAll()`). Идемпотентен; процесс не завершается — это решение хост-кода; структура и хранилища сохраняются.

### Patch

- Новые коды ошибок: `CTR_DEVICE_STOP_EXCEPTION`, `CTR_DEVICE_STOP_PROMISE_EXCEPTION`, `CTR_DEVICE_STOP_ALL_EXCEPTION`, `CTR_DEVICE_STOPPED`.
- Новые события контейнера: `stop` (id устройства), `beforeStop` / `afterStop` (начало/конец `stopAll()`).
- `MainProcess.run()` теперь полностью идемпотентен: `Bootstrap.loadBootList()` защищён повторными вызовами — при повторном `run()` boot-классы не пересоздаются и их обработчики событий не подписываются повторно.
- Нормализована обработка ошибок в `DeviceFileStorage`: ошибки чтения/записи хранения идут через `BootClass.error()` (событие `system.error`) — как в `StructureStorage`.
- Добавлен тест-страж синхронности кодов ошибок `src/` ↔ `docs/08-Errors.md` (в обе стороны): `test/unit/error-docs.test.ts`.
- Миграция всех внутренних вызовов с депрекейтед `Rule.require()` на `Rule.required()` (код boot-классов, jsdoc-примеры, тесты, фикстуры, доки).

## 2026.09.11

### Major

- Вынесено создание устройств из `Container` в `ServiceLoader`: `createDevice()`, `addDevice()`, `removeDevice()`, `checkDevice()`, `checkConnection()`, переопределение `confFile`, событие finalization `serviceLoaded` ([#15](https://github.com/vrack/vrack2-core/issues/15)).
- `Container` теперь чистый рантайм-контейнер: регистрация, состояние портов/соединений, ступенчатый `runProcess()`, hot `startDevice()`, `getStructure()` ([#15](https://github.com/vrack/vrack2-core/issues/15)).
- Добавлен `ICheckResult` — dry-run валидация конфигурации устройства и соединения ([#15](https://github.com/vrack/vrack2-core/issues/15)).

### Minor

- Добавлены `Device.render()`, `attachSharesRender()`, `detachSharesRender()`, реактивный accessors `shares` ([#14](https://github.com/vrack/vrack2-core/issues/14)).
- Добавлен класс утилиты `ReactiveRef` ([#14](https://github.com/vrack/vrack2-core/issues/14)).
- Добавлены классы `Metric` / `BasicMetric` и boot-класс `DeviceMetrics` для `vrack-db` ([#14](https://github.com/vrack/vrack2-core/issues/14)).
- Добавлены `Metric.inS()`, `Metric.inMs()`, `Metric.inUs()` — минимальная единица времени метрики ([#14](https://github.com/vrack/vrack2-core/issues/14)).

### Patch

- `Device.terminate()` теперь шлёт событие `device.terminate`.
- Добавлена `Utility.prettyFormat()`.
- Добавлена `Utility.isDeviceName()`.