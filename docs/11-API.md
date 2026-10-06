# Публичный API `vrack2-core`

Единственный источник правды по **публичному API** и его **статусу депрекации**.
Публичный API = ровно то, что экспортирует `src/index.ts` (пакет `vrack2-core`).
Множество runtime-экспортов зафиксировано strict-тестом в
[`test/smoke.test.ts`](../test/smoke.test.ts) — «exports exactly the documented
public API surface (strict set)». Новый экспорт появляется только вместе с
записью в этой таблице.

> **Типы-интерфейсы** (`IBootstrapEntry`, `IBootListConfig`, `IExecResult`,
> `IMetricSettings`, `IPort`, `IDeviceEvent`, `IDeviceStatus`,
> `IDeviceStatusMessage`, `IValidationProblem`, `IValidationRule`,
> `IValidationSubrule`, `SubruleName`, `IServiceStructure`, `IStructureDevice`,
> `ICheckResult`, `IMainProcessOptions`) — compile-only: они экспортируются из
> `src/index.ts`, но **не** попадают в runtime `Object.keys(require('vrack2-core'))`
> и поэтому в таблицу ниже и в strict-тест **не** входят.

## Статус депрекации (single source of truth)

Начиная с **2.0.0** активных `@deprecated` экспортов **нет**: все
депрекейтед-алиасы (`StandartPort`/`Port.standart()`, `Rule.require()`, старые
lifecycle-хуки `preProcess`/`process`/`processPromise`/`stop`/`stopPromise`/
`beforeTerminate`, `BootClass.process`/`processPromise`/`terminate`) удалены
(см. [CHANGELOG](../CHANGELOG.md)). Колонка **deprecated** в таблице ниже —
пустая именно потому, что депрекейтед-экспортов не осталось. Любая будущая
депрекация фиксируется **только** здесь и в [CHANGELOG](../CHANGELOG.md).

## Таблица экспортов

| Экспорт | Назначение | since | deprecated |
|---|---|---|---|
| `Action` | Базовый класс action устройства (декларативное описание). | 2.0.0 | — |
| `BasicAction` | Стандартная реализация `Action` (`.name()`, `.requirements()`, `.returns()`, `.description()`). | 2.0.0 | — |
| `BasicMetric` | Стандартная реализация `Metric` (`.name()`, `.in()`, `.description()`). | 2.0.0 | — |
| `BasicPort` | Базовый класс портов устройства. | 2.0.0 | — |
| `BasicType` | Базовый валидационный тип — блок `Rule` (`.required()`, `.min()`, …). | 2.0.0 | — |
| `BootClass` | Базовый класс boot-классов (lifecycle `onStart()` / `onStartAsync()` / `onDestroy()`). | 2.0.0 | — |
| `BootDatabase` | Машина состояний БД сервиса (`pending → ready → closed`), транзакции `acquire()`. | 2026.09.22 | — |
| `BootDatabaseMemory` | Адаптер БД: in-memory (`file = ':memory:'`), данные живут до конца процесса. | 2026.09.22 | — |
| `BootDatabaseSqlite` | Адаптер БД: SQLite на встроенном `node:sqlite` (нужен Node ≥ 22.5). | 2026.09.22 | — |
| `Bootstrap` | Загружает и запускает boot-классы (модули сервиса). | 2.0.0 | — |
| `Container` | Рантайм-контейнер: регистрация устройств, движение данных, lifecycle, события. | 2.0.0 | — |
| `CoreError` | Класс кодированной ошибки (бросается для ожидаемых сбоев). | 2.0.0 | — |
| `Device` | Базовый класс устройств (входы, выходы, actions, метрики, опции, lifecycle). | 2.0.0 | — |
| `DeviceConnect` | Внутренний класс-связка выходного и входного порта. | 2.0.0 | — |
| `DeviceFileStorage` | Boot-класс (обязателен): персистентность состояния/метрик устройства на диск. | 2.0.0 | — |
| `DeviceManager` | Boot-класс (обязателен): реестр устройств, резолв `vendor.Class`. | 2.0.0 | — |
| `DeviceMetrics` | Boot-класс: хранилище метрик через `vrack-db`. | 2.0.0 | — |
| `DevicePort` | Рантайм-класс порта (push, соединения, одноразовые слушатели). | 2.0.0 | — |
| `ErrorManager` | Синглтон-реестр кодовых ошибок (`register`/`registerMany`/`make`/`isCode`). | 2.0.0 | — |
| `ImportManager` | Утилита: импорт классов по `vendor.Class`, `camelize`, и универсальный `importClassUniversal()` (файл по пути **или** пакет, детекция автоматически), и др. | 2.0.0 | — |
| `MainProcess` | Точка входа; оркеструет Bootstrap → ServiceLoader → Container. | 2.0.0 | — |
| `Metric` | Базовый класс метрик устройства. | 2.0.0 | — |
| `Port` | Статический фабричный класс портов (`Port.standard()`, `Port.return()`). | 2.0.0 | — |
| `ReactiveRef` | Утилита реактивной ссылки (независима от `Device.shares`). | 2026.09.11 | — |
| `ReturnPort` | Порт типа `return`. | 2.0.0 | — |
| `Rule` | Фабрика правил валидации (`.string()`, `.number()`, `.required()`, …). | 2.0.0 | — |
| `ServiceLoader` | Собирает сервис из `service.json`: резолв классов, валидация, связь портов. | 2.0.0 | — |
| `StandardPort` | Порт типа `standard`. | 2.0.0 | — |
| `StorageTypes` | Константы типов хранилища (экспорт `vrack-db`). | 2.0.0 | — |
| `StructureStorage` | Boot-класс: персистентность структуры сервиса. | 2.0.0 | — |
| `SubruleNames` | Константа имён подправил валидации (для `Rule`/`Validator`). | 2.0.0 | — |
| `UniversalWorker` | Утилита: абстракция воркера (thread/process). | 2.0.0 | — |
| `Utility` | Утилита: `isDeviceName()` (проверка id устройства), `prettyFormat()` (человекочитаемый формат значений). | 2.0.0 | — |
| `Validator` | Запуск валидации `Rule` по данным (`Validator.validate`). | 2.0.0 | — |
| `mergeBootList` | Чистая функция слоёвого merge конфигов boot-классов. | 2026.09.21 | — |

## Связанные документы

- [00-Overview](00-Overview.md) — что это, глоссарий.
- [06-Container](06-Container.md) — публичный API контейнера и события.
- [08-Errors](08-Errors.md) — все коды ошибок.
- [10-Standalone](10-Standalone.md) — запуск сервиса standalone.
