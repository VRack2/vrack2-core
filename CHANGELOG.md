# Changelog

## 2026.10.07

### Major

- **Метрики переведены на `vrack2-journal-db`**: по умолчанию boot-класс метрик — `JournalDbMetrics` (база `vrack2-journal-db`). Старая реализация на `vrack-db` сохранена как `VrackDbMetrics` — переключается в `service.json` ключом `bootstrap.DeviceMetrics` (id не меняется).
- **Breaking**: экспорт `DeviceMetrics` удалён; вместо него — `JournalDbMetrics` (по умолчанию) и `VrackDbMetrics` (обратная совместимость). Экспортируются из `vrack2-core`.
- **Breaking**: `Device.metric(path, value, modify?)` — параметр `modify` **убран**: агрегация задаётся в объявлении метрики через `Metric.modify('min'|'max'|'sum'|'avg'|'count')` (по умолчанию `avg`). `IvUs`/`Metric.inUs()` (микросекунды) удалены — минимальная единица `inS()`/`inMs()`.

### Tests

- `test/integration/service.test.ts`, `hot-devices.test.ts`, `boot-database.test.ts`: boot-класс `DeviceMetrics` заменён на `JournalDbMetrics`; `read()`/`aggregate()` по новому API.
- `test/fixtures/devices/testkit/{Counter,Lamp}.js`: `modify` вынесен в объявление метрики; `this.metric(path, value)` — 2 аргумента.

### Docs

- 01-Architecture, 04-Ports-Actions-Metrics, 06-Container, 07-Bootstrap, 10-Standalone, 11-API: метрики на `JournalDbMetrics`/`VrackDbMetrics`, `modify` в объявлении, API-таблица.

## 2026.10.06

### Minor

- **Универсальный импорт классов**: новый публичный метод `ImportManager.importClassUniversal(ref)` — автоматически определяет тип ссылки и возвращает класс. (1) путь к **файлу** (абсолютный, `./`/`../`, с `/` или расширением `.js`/`.mjs`/`.cjs`/`.ts`/`.json`/`.node`) → импорт файла + `default`-экспорт; (2) `vendor.Class` (пакет по точкам) → как `importClass`; (3) голый пакет → импорт + `default`. Экспортируется из `vrack2-core` (метод существующего экспорта `ImportManager` — набор value-экспортов не меняется, smoke-тест проходит).
- **Boot-классы по файлу и устройство в роли boot-класса**: поле `path` в `IBootstrapEntry` теперь принимает **и пакет, и путь к файлу** (`Bootstrap.loadBootList()` использует `importClassUniversal`). Разрешённый класс может наследовать не только `BootClass`, но и `Device`; для `Device` лоадер сам валидирует опции и заполняет дефолты (`Validator.validate`), чего раньше не было. Побочный эффект: `type` теперь берётся из имени класса (`ExClass.name`), а не из последнего сегмента пути.
- Новый код ошибки `IM_IMPORT_FAILED` (модуль `ImportManager`): не удалось импортировать класс по файлу или по пакету — таблица в [08-Errors](docs/08-Errors.md).
- Документация: 07-Bootstrap (универсальная `path`, Device допустим, обновлён псевдокод `loadBootList`), 08-Errors (`IM_IMPORT_FAILED`), 09-Utils (метод `importClassUniversal`), 11-API (описание `ImportManager`).

### Tests

- `test/unit/import-manager.test.ts`: +5 тестов `importClassUniversal` — пакетный путь (равен `importClass`), файл по относительному/абсолютному пути, отсутствующий файл (`IM_FILE_NOT_FOUND`), неизвестный вендор (`IM_CLASS_VENDOR_ERROR`).
- `test/integration/service.test.ts`: +1 — «boot-класс из локального файла (относительный путь) — Device в роли boot-класса»: `Lamp` загружается по `test/fixtures/devices/testkit/Lamp.js`, `instanceof Device`, дефолтная опция `maxBrightness: 200`.

## 2026.09.29

### Major

- **Breaking**: `beforeAction()` переименован в `onBeforeAction()` и **подключён** к `Container.deviceAction()`: хук вызывается после валидации аргументов, до хендлера, с событием `action.before`; если вернуть `false` — действие отклоняется ошибкой `CONT_DEVICE_ACTION_VETOED` (fail-closed). Базовая реализация — `return true` (нет-то).
- **Breaking**: имена кодов ошибок разнесены по модулям — общий префикс заменён на префикс модуля-владельца кода:
  - `DB_SERVICE_FILE` / `DB_SERVICE_FILE_NOT_FOUND` / `DB_SERVICE_INVALID` / `DB_SERVICE_LOAD_ERROR` → `DBL_*` (ServiceLoader); `DB_DEVICE_NOT_READY` остаётся `DB_*` (MainProcess);
  - `BS_SERVICE` / `BS_SERVICE_NOT_FOUND` / `BS_SERVICE_INVALID` → `BSL_*` (ServiceLoader); `BS_NO_DATABASE` остаётся `BS_*` (MainProcess);
  - `CTR_*` → `CONT_*` (Container), кроме пяти кодов ServiceLoader → `SLDR_*`: `SLDR_CONF_EXTENDS_PROBLEM`, `SLDR_ERROR_INIT_DEVICE`, `SLDR_ERROR_INIT_CONNECTION`, `SLDR_ERROR_PREPARE_OPTIONS`, `SLDR_INCORRECT_DEVICE_ID`; `CTR_DEVICE_DUPLICATE` → `CONT_DEVICE_DUPLICATE` (владелец — Container).

  Старые коды как алиасы **не** введены — `ErrorManager.isCode()` и документы принимают только новые. Полная таблица — [08-Errors](docs/08-Errors.md).

### Minor

- **Миграция boot-классов завершена**: ядро-обвязка (в т.ч. `DeviceFileStorage`) использует только канонические `on*` имена (`process()` / `processPromise()` в boot-классах убраны); `test/unit/lifecycle-hooks.test.ts` переписан на канонические имена (back-compat-кейсы убраны); депрекейшн-заметки удалены из доков (01, 03, 04, 07).
- Новый документ [docs/11-API.md](docs/11-API.md) — таблица публичного API (`src/index.ts`) со столбцами `name / purpose / since / deprecated` — **single source of truth** по депрекациям. Строгий smoke-тест `test/smoke.test.ts` фиксирует точный набор value-экспортов (несовпадение с таблицей — падение).
- `docs/01-Architecture.md`: добавлены mermaid-диаграммы — последовательность запуска (sequence) и состояния устройства (state diagram).
- JSDoc публичных классов (`Device`, `BootClass`, `Container`, `MainProcess`, `ServiceLoader`, `Bootstrap`) приведён к единому шаблону: описание / `@returns` / `@example`.
- `MainProcess`: добавлен class-level JSDoc и JSDoc у `run()` / `check()` (у `stop()` уже был).

## 2026.09.27

### Major

- **Breaking**: убрана реактивность `Device.shares`. `shares` — теперь обычный объект (обычное поле базового класса, дефолт `{}`; подкласс задаёт его обычным типизированным полем). Изменение `shares` (запись, новое свойство, `delete`, полная замена) **больше ничего не эмитит** — устройство явно вызывает `render()` после изменений.
- **Breaking**: удалены `Device.attachSharesRender()` / `Device.detachSharesRender()` (Container их больше не вызывает) и `Device.sharesSnapshot()`. `ReactiveRef` остаётся в публичном API как самостоятельная утилита (см. [09-Utils](docs/09-Utils.md)), но `Device` его больше не использует.
- `Device.render()` шлёт `device.render` со **живой ссылкой** на `shares` (была глубокая plain-копия). Подписчик обязан считать `trace` read-only (мутация меняет состояние устройства) и клонировать сам (`structuredClone`) перед пересылкой за границу сериализации (postMessage, ответ воркера). Убран re-entrancy guard — без авто-рендера вложенный render невозможен.
- Документация: 00-Overview (строка «Shares»), 01-Architecture (раздел «shares / render»), 03-Device (свойства, регистрация, методы, раздел «Как работают `shares` и `render()`»), 06-Container (регистрация, `removeDevice()`).

### Tests

- `test/unit/device-shares.test.ts` переписан под явную семантику: мутации не шлют событий; `render()` шлёт живую ссылку (`trace === shares`); `render()` работает без изменений и после `removeDevice()`; `shares` — plain-объект (`structuredClone` напрямую); поля-дефолты подкласса и legacy-фикстуры (`SharesField.js`) остаются начальным состоянием.
- `test/smoke.test.ts`: вместо `sharesSnapshot` — проверка `Device.prototype.render`.

## 2026.09.22

### Minor

- База данных для сервиса: новый boot-класс `BootDatabase` (машина состояний `pending → ready → closed`, гварды публичных методов, переупаковка ошибок драйвера в кодовые `BDB_*`, вся логика транзакций `acquire()` → `BEGIN` → `fn(tx)` → `COMMIT`/`ROLLBACK` → `release()`) и два адаптера из коробки: `BootDatabaseSqlite` (SQLite на встроенном модуле `node:sqlite` — ноль внешних зависимостей; требует Node ≥ 22.5 в момент подключения, на старых рантаймах fail-fast `BDB_CONNECT_FAILED`) и `BootDatabaseMemory` (`file = ':memory:'`, данные живут до конца процесса). БД объявляется в секции `bootstrap` сервиса — общий ресурс всех устройств, один экземпляр на id; адаптер реализует только контрактные методы `connect/disconnect/_query/_execute/acquire/release`.
- Новый публичный API: `Device.getDB(id = 'DB')` — доступ к базе из device-кода (типируется по интерфейсу `BootDatabase`; не объявлена в bootstrap → `BTSP_CLASS_ID_NOT_FOUND`). Экспортируются из `vrack2-core`: `BootDatabase`, `IExecResult`, `BootDatabaseSqlite`, `BootDatabaseMemory`.
- Опции `BootDatabaseSqlite`: `file` (обязательная), `wal` (по умолчанию `true`; не действует на in-memory и read-only), `readOnly` (по умолчанию `false`).
- Новые коды ошибок (модуль `BootDatabase`): `BDB_NOT_READY`, `BDB_CLOSED`, `BDB_CONNECT_FAILED`, `BDB_QUERY_FAILED` (несёт `message`/`driverCode`, но не SQL и не параметры), `BDB_BUSY`, `BDB_TX_LOCKED`, `BDB_TRANSACTION_FAILED` — таблица в [08-Errors](docs/08-Errors.md).
- Документация: 07-Bootstrap — раздел «BootDatabase / BootDatabaseSqlite / BootDatabaseMemory» (опции, публичный API, поведение); 03-Device — раздел «База данных (`getDB()`)» с примером; 08-Errors — коды `BDB_*`.

### Tests

- `test/unit/boot-database.test.ts` — контракт адаптеров: машина состояний, гварды, транзакции (COMMIT/ROLLBACK, вложенность), переупаковка ошибок (скелет драйвера).
- `test/unit/boot-database-sqlite.test.ts` — `BootDatabaseSqlite` / `BootDatabaseMemory`: подключение и fail-fast (`BDB_CONNECT_FAILED`), живучесть данных после `terminate()`, WAL (вкл/выкл), read-only, обёртка ошибок драйвера без утечки SQL, транзакции (commit / атомарный rollback / `BDB_BUSY`), изоляция in-memory инстансов.
- `test/integration/boot-database.test.ts` — реальный `MainProcess` с БД в bootstrap: старт/остановка (после — `BDB_CLOSED`), живучесть данных между двумя запусками процесса, fail-fast при невалидных опциях (`VR_NOT_PASS`) и неудачном подключении (`BDB_CONNECT_FAILED`, `driverCode = ERR_SQLITE_ERROR`), доступ устройства через `getDB()` (запрос в `processPromise()`, транзакция в action).
- Фикстура: `test/fixtures/devices/testkit/DbReader.js` (+ запись в `list.json`).

## 2026.09.21

### Minor

- Слоевая конфигурация boot-классов: `service.json` (поле `bootstrap`) и конф-файл (секция `bootstrap`) могут объявлять/перекрывать boot-классы поверх ядерных дефолтов. Приоритет снизу вверх: `MainProcess.DEFAULT_BOOTLIST` → `service.bootstrap` → `bootstrap` конф-файла → аргумент конструктора. Семантика записи на id: запись с `path` — добавляет/полностью заменяет; запись без `path` — поштучно перекрывает `options` уже объявленного id (иначе `BTSP_BAD_BOOTLIST`); `null` — удаляет id.
- Новый публичный API: `mergeBootList(layers)` (чистая функция слоёвого merge; nullish-слои пропускаются, входы не мутируются), типы `IBootListConfig` / `IBootstrapEntry`, `IMainProcessOptions` — экспортированы из `vrack2-core`.
- Новый код ошибки `BTSP_BAD_BOOTLIST` (модуль Bootstrap): некорректная запись boot-листа (нет `options`) или запись без `path`, не совпадающая ни с одним id нижних слоёв.
- `IServiceStructure` получил опциональное поле `bootstrap?: IBootListConfig`; конструктор `MainProcess` мержит четыре слоя при создании, секция конф-файла читается на конструировании (до создания boot-инстансов).

### Tests

- `test/unit/mergeBootList.test.ts` — 12 юнит-тестов merge-семантики (replace, options-only, null, порядок, приоритет слоёв, отсутствие мутаций, ошибки).
- `test/integration/service.test.ts` — новый describe «Layered boot-list config» (7 тестов: кастомный path в service-файле, options-only перекрывание, null-удаление, orphan-ошибка, приоритет конструктора, конф-файл поверх service-файла).

## 2026.09.19

### Major

- Систематизированный статус устройства: контейнер ведёт запись `IDeviceStatus` на каждое зарегистрированное устройство — состояние `state` (`registered`/`started`/`stopped`), время последнего изменения, последнее сообщение alert/error (`{ data, trace, at }`) и счётчики `alertCount`/`errorCount`.
- Новый канал `status`: при каждом изменении статуса контейнер эмитит событие `device.status` с полным снапшотом в стандартном конверте `{ device, data: 'status', trace: IDeviceStatus }`. Триггеры: регистрация устройства, успешный старт (`runProcess()`/`startDevice()`), остановка (`stopDevice()`), события `device.alert`/`device.error`/`device.terminate`.
- Новые методы контейнера: `getDeviceStatus(id)` (копия статуса или `undefined`) и `deviceStatusList()` (копии статусов всех устройств). Типы `IDeviceStatus` / `IDeviceStatusMessage` экспортируются из публичного API.
- Новый метод устройства: `sharesSnapshot()` — глубокая plain-копия `shares` без реактивных прокси. `this.shares` возвращает Proxy из `ReactiveRef`, который `structuredClone` / postMessage отклоняют с `DataCloneError`; метод возвращает сериализуемую копию (plain-объекты/массивы клонируются, циклы сохраняются, `Date`/`Map`/экземпляры классов проходят как есть — семантика `ReactiveRef.snapshot()`).
- `'status'` добавлен в каналы по умолчанию `Device.settings().channels`.

### Minor

- Тесты: новый интеграционный срез `test/integration/device-status.test.ts` (10 тестов).
- Документация: 03-Device — автоматический канал `status`; 06-Container — раздел «Статус устройства», методы доступа, событие в таблице.

## 2026.09.17

### Minor

- Типизация `Device.shares` по классу без generic и хуков: подкласс объявляет `shares = {...}` обычным типизированным полем — внутри класса `this.shares` имеет ровно его форму (IDE подсказывает). Реактивные accessors установлены на prototype базового класса, а в модели типов `shares` — обычное свойство, поэтому поле наследника легально.
- Механика: после `preProcess()` Container импортирует значение поля в реактивный ref (`attachSharesRender()`) и снимает тень (ES2022 class fields) — уточнения из `preProcess()` сохраняются; без поля дефолт `{}`. Storage — обычное инстансное поле `_sharesRef` (без WeakMap и прототипных хаков).
- Type-level тест: `test/typing/device-shares.ts` + `tsconfig.typetest.json`; скрипт `npm run typecheck:types`.

### Chores

- Миграция ESLint-конфига с `.eslintrc.js` на flat `eslint.config.js` (ESLint 9 по умолчанию не находит legacy-формат, из-за чего `npm run lint` падал ещё до проверки файлов). Явно настроены Node-globals, для TS-файлов включён `@typescript-eslint/no-unused-vars` (вместо базового), исключена `lib/`.
- Отключено правило `no-explicit-any` (`any` в проекте — осознанный выбор стиля); удалены мёртвые импорты (`ChildProcess`, `BasicAction`, `SingleDB`).

## 2026.09.15 — 2.0.0 (breaking)

### Major

- **Убрано поле `CoreError.vCode`** (случайный машинный код). Единственный канонический идентификатор ошибки — `vShort` (читаемый код, например `VR_NOT_PASS`): на него смотрят `ErrorManager.isCode()` и документы.
- **Сигнатура `ErrorManager.register()`**: `(name, short, description, rules?)` — аргумент `code` удалён. Повторная регистрация идентичной записи — без действия; другая запись с тем же `short` — `EM_CODE_EXISTS`.
- Конструктор `CoreError` принимает 3 аргумента: `(name, message, short)`.
- Новый метод `ErrorManager.registerMany(name, list)` — массовая (атомарная) регистрация кодов одного компонента: `name` — группа, `list` — массив `{ short, description, rules? }`; при конфликте любого элемента ничего не регистрируется (`EM_CODE_EXISTS`).
- Из `IValidationProblem` удалено поле `code` (валидатор уже передаёт тип проблемы в `type`).
- Все коды ошибок в `src/` зарегистрированы по `short` (12-символьные литералы `code` удалены).

### Patch

- `docs/08-Errors.md`: убрана колонка/поле `vCode`, описаны `rules`/`vAdd`; `docs/00-Overview.md`: глоссарий ссылки на `vShort`.
- Тесты: `test/unit/error-docs.test.ts` сканирует `short` как второй аргумент `register()`; `errors.test.ts` / `smoke.test.ts` проверены на отсутствие `vCode`.

## 2026.09.13

### Major

- Реверсивная остановка устройств: `Container.stopDevice(id)` / `Container.stopAll()`, хуки устройства `Device.stop()` / `Device.stopPromise()`. Остановка обратима: повторный запуск — `Container.startDevice()` (повторно выполняются `process()` + `processPromise()`, снова включаются порты и actions).
- Убран `Device.works`: его заменило `Device.running` — состояние работы, которым **управляет контейнер**: `true` с конструктора (как у `works`), `false` после `stopDevice()` / `stopAll()` / `removeDevice()`, снова `true` при `startDevice()` (до `process()`).
- Остановленное устройство (`running = false`) не принимает данные портов (`push` отбрасывается), а его actions отклоняются ошибкой `CONT_DEVICE_STOPPED`. Не-запущенное (или ещё запускающееся) устройство остановленным **не считается** — его порты активны.
- `Container.removeDevice()` и `ServiceLoader.removeDevice()` теперь асинхронные (возвращают `Promise`): работающее устройство сначала останавливается (`stop()` + `stopPromise()`), и только потом вызывается `beforeTerminate()`. Падение хуков остановки прерывает удаление (fail-closed) — устройство остаётся в контейнере.
- Добавлен `MainProcess.terminate()` — graceful-завершение сервиса: останавливает все работающие устройства (через `Container.stopAll()`). Идемпотентен; процесс не завершается — это решение хост-кода; структура и хранилища сохраняются.

### Fix

- **Критично**: при интродукции `stopDevice()` начальное значение `running` стало `false` — и `DevicePort.push` (`!running`) **тихо отбрасывал весь портовый трафик, созданный во время старта устройства** (`process()` / `processPromise()`), в частности регистрацию команд устройств в Master/ServiceManager («command not found» на стороне сервиса). `running` снова `true` с конструктора (семантика старого `works`) и `false` только после явной остановки: не-запущенные и запускающиеся устройства снова пропускают данные, остановленные — по-прежнему отбрасывают.

### Patch

- Новые коды ошибок: `CONT_DEVICE_STOP_EXCEPTION`, `CONT_DEVICE_STOP_PROMISE_EXCEPTION`, `CONT_DEVICE_STOP_ALL_EXCEPTION`, `CONT_DEVICE_STOPPED`.
- Новые события контейнера: `stop` (id устройства), `beforeStop` / `afterStop` (начало/конец `stopAll()`).
- `MainProcess.run()` теперь полностью идемпотентен: `Bootstrap.loadBootList()` защищён повторными вызовами — при повторном `run()` boot-классы не пересоздаются и их обработчики событий не подписываются повторно.
- Нормализована обработка ошибок в `DeviceFileStorage`: ошибки чтения/записи хранения идут через `BootClass.error()` (событие `system.error`) — как в `StructureStorage`.
- Добавлен тест-страж синхронности кодов ошибок `src/` ↔ `docs/08-Errors.md` (в обе стороны): `test/unit/error-docs.test.ts`.

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