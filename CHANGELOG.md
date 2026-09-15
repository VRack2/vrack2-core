# Changelog

## 2026.09.15 — 2.0.0 (breaking)

### Major

- **Убрано поле `CoreError.vCode`** (случайный машинный код). Единственный канонический идентификатор ошибки — `vShort` (читаемый код, например `VR_NOT_PASS`): на него смотрят `ErrorManager.isCode()` и документы.
- **Сигнатура `ErrorManager.register()`**: `(name, short, description, rules?)` — аргумент `code` удалён. Повторная регистрация идентичной записи — без действия; другая запись с тем же `short` — `EM_CODE_EXISTS`.
- Конструктор `CoreError` принимает 3 аргумента: `(name, message, short)`.
- Из `IValidationProblem` удалено поле `code` (валидатор уже передаёт тип проблемы в `type`).
- Все коды ошибок в `src/` зарегистрированы по `short` (12-символьные литералы `code` удалены).

### Patch

- `docs/08-Errors.md`: убрана колонка/поле `vCode`, описаны `rules`/`vAdd`; `docs/00-Overview.md`: глоссарий ссылки на `vShort`.
- Тесты: `test/unit/error-docs.test.ts` сканирует `short` как второй аргумент `register()`; `errors.test.ts` / `smoke.test.ts` проверены на отсутствие `vCode`.

## 2026.09.13

### Major

- Реверсивная остановка устройств: `Container.stopDevice(id)` / `Container.stopAll()`, хуки устройства `Device.stop()` / `Device.stopPromise()`. Остановка обратима: повторный запуск — `Container.startDevice()` (повторно выполняются `process()` + `processPromise()`, снова включаются порты и actions).
- Убран `Device.works`: его заменило `Device.running` — состояние работы, которым **управляет контейнер**: `true` с конструктора (как у `works`), `false` после `stopDevice()` / `stopAll()` / `removeDevice()`, снова `true` при `startDevice()` (до `process()`).
- Остановленное устройство (`running = false`) не принимает данные портов (`push` отбрасывается), а его actions отклоняются ошибкой `CTR_DEVICE_STOPPED`. Не-запущенное (или ещё запускающееся) устройство остановленным **не считается** — его порты активны.
- `Container.removeDevice()` и `ServiceLoader.removeDevice()` теперь асинхронные (возвращают `Promise`): работающее устройство сначала останавливается (`stop()` + `stopPromise()`), и только потом вызывается `beforeTerminate()`. Падение хуков остановки прерывает удаление (fail-closed) — устройство остаётся в контейнере.
- Добавлен `MainProcess.terminate()` — graceful-завершение сервиса: останавливает все работающие устройства (через `Container.stopAll()`). Идемпотентен; процесс не завершается — это решение хост-кода; структура и хранилища сохраняются.

### Fix

- **Критично**: при интродукции `stopDevice()` начальное значение `running` стало `false` — и `DevicePort.push` (`!running`) **тихо отбрасывал весь портовый трафик, созданный во время старта устройства** (`process()` / `processPromise()`), в частности регистрацию команд устройств в Master/ServiceManager («command not found» на стороне сервиса). `running` снова `true` с конструктора (семантика старого `works`) и `false` только после явной остановки: не-запущенные и запускающиеся устройства снова пропускают данные, остановленные — по-прежнему отбрасывают.

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