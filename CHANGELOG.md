# Changelog

## 2026.09.28

### Minor

- Новые канонические имена lifecycle-хуков `Device`: `onRegister()` (устар. `preProcess()`), `onStart()` (устар. `process()`), `onStartAsync()` (устар. `processPromise()`), `onStop()` (устар. `stop()`), `onStopAsync()` (устар. `stopPromise()`), `onDestroy()` (устар. `beforeTerminate()`); и `BootClass`: `onStart()` (устар. `process()`), `onStartAsync()` (устар. `processPromise()`), `onDestroy()` (устар. `terminate()`).
- Старые имена помечены `@deprecated` и в переходный период **по-прежнему вызываются ядром** (рядом с новыми) — переопределять можно любой из пары **без** `super`; в следующей мажорной версии вызовы старых будут удалены. Базовые реализации всех хуков — пустые no-op, поэтому переход — чистое переименование метода.
- Ядро и все boot-классы (`DeviceFileStorage`, `DeviceManager`, `DeviceMetrics`, `StructureStorage`, `BootDatabase` и адаптеры) в переходный период вызывают **и новые, и старые** хуки; `MainProcess`/`ServiceLoader` синхронизированы с новой схемой.
- Документация: 01-Architecture (каноническая последовательность + API контейнера), 03-Device (жизненный цикл, таблица методов, заметка о депрекейшн), 07-Bootstrap (API `BootClass`, лоадер). Дополнительно синхронизированы имена событий в 02-AppStructure, 04-Ports-Actions-Metrics, 06-Container, 10-Standalone: устаревшие `serviceLoaded` / `beforeProcess` / `beforeProcessPromise` / `device.register.metric` / `beforeLoaded`·`loaded` / `beforeStop`·`afterStop` заменены на актуальные `service.loaded` / `service.start.begin` / `service.startAsync.begin` / `device.metric.register` / `service.ready.begin`·`service.ready` / `service.stop.begin`·`service.stop.end`.
- Тесты: `test/unit/lifecycle-hooks.test.ts` — новые имена вызываются на своей фазе; старые имена продолжают работать; при переопределении обоих — оба выполняются (порядок: новый → старый), `super` не требуется. Существующие тесты и фикстуры (`device-stop`, `boot-database`, `hot-devices`, `service`, `boot-database-sqlite`, `device-shares`; фикстуры `Tracker`, `StopFail`, `DbReader`, `Lamp`, `SharesField`, `Counter`, `fixtures/boot/index.js`) переписаны на новые имена хуков.

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

- База данных для сервиса: новый boot-класс `BootDatabase` (машина состояний `pending → ready → closed`, гварды публичных методов, переупаковка ошибок драйвера в кодовые `DB_*`, вся логика транзакций `acquire()` → `BEGIN` → `fn(tx)` → `COMMIT`/`ROLLBACK` → `release()`) и два адаптера из коробки: `BootDatabaseSqlite` (SQLite на встроенном модуле `node:sqlite` — ноль внешних зависимостей; требует Node ≥ 22.5 в момент подключения, на старых рантаймах fail-fast `DB_CONNECT_FAILED`) и `BootDatabaseMemory` (`file = ':memory:'`, данные живут до конца процесса). БД объявляется в секции `bootstrap` сервиса — общий ресурс всех устройств, один экземпляр на id; адаптер реализует только контрактные методы `connect/disconnect/_query/_execute/acquire/release`.
- Новый публичный API: `Device.getDB(id = 'DB')` — доступ к базе из device-кода (типируется по интерфейсу `BootDatabase`; не объявлена в bootstrap → `BTSP_CLASS_ID_NOT_FOUND`). Экспортируются из `vrack2-core`: `BootDatabase`, `IExecResult`, `BootDatabaseSqlite`, `BootDatabaseMemory`.
- Опции `BootDatabaseSqlite`: `file` (обязательная), `wal` (по умолчанию `true`; не действует на in-memory и read-only), `readOnly` (по умолчанию `false`).
- Новые коды ошибок (модуль `BootDatabase`): `DB_NOT_READY`, `DB_CLOSED`, `DB_CONNECT_FAILED`, `DB_QUERY_FAILED` (несёт `message`/`driverCode`, но не SQL и не параметры), `DBS_BUSY`, `DB_TX_LOCKED`, `DB_TRANSACTION_FAILED` — таблица в [08-Errors](docs/08-Errors.md).
- Документация: 07-Bootstrap — раздел «BootDatabase / BootDatabaseSqlite / BootDatabaseMemory» (опции, публичный API, поведение); 03-Device — раздел «База данных (`getDB()`)» с примером; 08-Errors — коды `DB*`.

### Tests

- `test/unit/boot-database.test.ts` — контракт адаптеров: машина состояний, гварды, транзакции (COMMIT/ROLLBACK, вложенность), переупаковка ошибок (скелет драйвера).
- `test/unit/boot-database-sqlite.test.ts` — `BootDatabaseSqlite` / `BootDatabaseMemory`: подключение и fail-fast (`DB_CONNECT_FAILED`), живучесть данных после `terminate()`, WAL (вкл/выкл), read-only, обёртка ошибок драйвера без утечки SQL, транзакции (commit / атомарный rollback / `DBS_BUSY`), изоляция in-memory инстансов.
- `test/integration/boot-database.test.ts` — реальный `MainProcess` с БД в bootstrap: старт/остановка (после — `DB_CLOSED`), живучесть данных между двумя запусками процесса, fail-fast при невалидных опциях (`VR_NOT_PASS`) и неудачном подключении (`DB_CONNECT_FAILED`, `driverCode = ERR_SQLITE_ERROR`), доступ устройства через `getDB()` (запрос в `processPromise()`, транзакция в action).
- Фикстура: `test/fixtures/devices/testkit/DbReader.js` (+ запись в `list.json`).

## 2026.09.21

### Minor

- Слоевая конфигурация boot-классов: `service.json` (поле `bootstrap`) и конф-файл (секция `bootstrap`) могут объявлять/перекрывать boot-классы поверх ядерных дефолтов. Приоритет снизу вверх: `MainProcess.DEFAULT_BOOTLIST` → `service.bootstrap` → `bootstrap` конф-файла → аргумент конструктора. Семантика записи на id: запись с `path` — добавляет/полностью заменяет; запись без `path` — поштучно перекрывает `options` уже объявленного id (иначе `BS_BAD_BOOTLIST`); `null` — удаляет id.
- Новый публичный API: `mergeBootList(layers)` (чистая функция слоёвого merge; nullish-слои пропускаются, входы не мутируются), типы `IBootListConfig` / `IBootstrapEntry`, `IMainProcessOptions` — экспортированы из `vrack2-core`.
- Новый код ошибки `BS_BAD_BOOTLIST` (модуль Bootstrap): некорректная запись boot-листа (нет `options`) или запись без `path`, не совпадающая ни с одним id нижних слоёв.
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