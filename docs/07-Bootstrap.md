# 07 — Bootstrap и boot-классы

> **Зачем читать:** понимать, как расширяется контейнер «сверху»: что такое boot-класс, как он загружается, и что делают пять стандартных boot-классов (устройства, хранилище, метрики, структура, база данных).
> **Кому:** интеграторам и авторам boot-классов.
>
> ← [06-Container](06-Container.md) · [Далее: 08-Errors](08-Errors.md) →

## Что такое boot-класс

Boot-класс — служебный модуль, работающий **вместе с** контейнером: слушает его события и оказывает вспомогательные услуги — сохраняет состояние устройств на диск, пишет метрики в базу, ведёт реестр доступных устройств.

В отличие от устройства boot-класс не является частью сервиса: у него нет портов, соединений и структуры. Он живёт вне контейнера, поэтому его можно заменить своей реализацией, не трогая устройства. Пример: `DeviceManager` — нужен для запуска сервиса, но заменяемый и настраиваемый.

> **Примечание:** в списке boot-классов разрешён и `Device` (устройство) — его опции валидируются лоадером тем же валидатором, что и у `BootClass`. А ссылка (`path`) указывает не только на пакет, но и на **файл** — см. ниже, `Bootstrap` лоадер.

Каждый boot-класс создаётся один раз на контейнер (внутри `Bootstrap`) и общается с контейнером через события (`on` / `emit`).

## `BootClass` API

```ts
class MyBoot extends BootClass {
    id: string                 // уникальный id из списка
    type: string               // путь к классу, 'vendor.MyBoot'
    Container: Container       // контейнер, для которого загружен
    options: object            // опции из списка (валидируются)

    checkOptions(): { [key: string]: BasicType } { ... }  // правила опций
    onStart() { }               // входная точка старта (синхронная)
    async onStartAsync() { }    // асинхронный старт (лоадер ждёт всех)
    async onDestroy() { }       // graceful-остановка (вызывается Bootstrap.destroyAll())
    error(error: Error) { }     // Container.emit('system.error', error)
}
```

Конструктор: `(id, type, Container, options)` — проверяет `options` по правилам `checkOptions()`; при несовпадении — исключение (тот же валидатор, что и для опций устройств).

## `Bootstrap` лоадер

```ts
interface IBootListConfig {
    [id: string]: { path: string, options: { [key: string]: any } }
}

new Bootstrap(config)
await bootstrap.loadBootList(Container)
bootstrap.getBootClass('DeviceMetrics', DeviceMetrics)
await bootstrap.destroyAll()   // graceful-остановка ВСЕХ boot-классов
```

`loadBootList(Container)`:

`path` в записи — **универсальная ссылка** на класс: это либо VRack-путь пакета
(`'vrack2-core.DeviceManager'`), либо **путь к файлу** (абсолютный или относительный
от рабочей директории, `'./boot/MyRegistry.js'`). Тип определяется автоматически
(`ImportManager.importClassUniversal()`). Разрешённый класс может наследовать и
`BootClass`, и `Device` (устройство тоже допустимо в роли boot-класса — его опции
валидируются в лоадере тем же валидатором, что и у `BootClass`).

```
для каждого класса из config:
  ExClass = await ImportManager.importClassUniversal(path)
  inst = new ExClass(id, ExClass.name, Container, options)
  if (!(inst instanceof BootClass || inst instanceof Device)) throw BTSP_INSTANCE_OF_INCORRECT
  if (inst instanceof Device)
      inst.options = options
      Validator.validate(inst.checkOptions(), inst.options)   // дефолты + required
  loaded[id] = inst

для каждого загруженного: onStart()
для каждого загруженного: await onStartAsync()
```

Ошибки: `BTSP_CLASS_ID_NOT_FOUND`, `BTSP_INSTANCE_OF_INCORRECT`, `BTSP_TERMINATE_FAILED`.

### `destroyAll()` — остановка boot-классов

Boot-классы владеют ресурсами уровня процесса (пул БД, файловые дескрипторы), которые живут всё время жизни сервиса, поэтому останавливаются **только все сразу** — нет публичного «остановить один boot-класс»: закрыть один общий ресурс, пока сервис ещё работает, оставило бы остальные без него.

```
для каждого загруженного В ОБРАТНОМ порядке загрузки: await onDestroy()   // ошибки не прерывают цикл
```

Поведение:

- Вызывается один раз на процесс; повторный вызов — no-op (лatch, симметрия `loadAttempted`-флага `loadBootList()`).
- Порядок — **обратный** порядку загрузки (симметрия `Container.stopAll()`): сначала высвобождаются поздние boot-классы, общие ресурсы (например, БД) нижних классов живут, пока зависящие от них завершаются.
- Сбой `onDestroy()` одного boot-класса **не блокирует** остальные — они всё равно останавливаются, а ошибка уходит в `system.error` (`BTSP_TERMINATE_FAILED`).
- `onDestroy()` — lifecycle-хук, а не публичный API: device-коду обращаться к ресурсам boot-класса следует через их публичные методы (как `DeviceMetrics.read()` / `DeviceMetrics.has()`), а `onDestroy()` используется только самим `Bootstrap`.

## Пять стандартных boot-классов

> **Важно:** `DeviceManager` — единственная **обязательная** запись: `ServiceLoader.createDevice()` ищет его по id (`Bootstrap.getBootClass('DeviceManager', DeviceManager)`), без него сервис с устройствами не запустится. Остальные четыре — необязательны: без `DeviceFileStorage` нет сохранения состояний, без `DeviceMetrics` — метрик в `vrack-db`, без `StructureStorage` — структуры на диске, без `BootDatabase*` — общей базы данных устройств (см. [03-Device](03-Device.md), `getDB()`). Каждый можно заменить своей реализацией.

### `DeviceManager`

Реестр устройств: сканирует `devices/` и предоставляет доступ к классам.

| Опция | По умолчанию |
|---|---|
| `dir` | `./devices` |
| `systemDir` | `ImportManager.systemPath()` |

Методы: `getVendorList()`, `getVendorDeviceList(vendor)`, `getDeviceInfo(vendor, device)`, `get(device)` (возвращает класс устройства).

При `onStart()` — `updateDeviceList()`: для каждого вендора читает `list.json` (массив или объект); ошибки (`DM_LIST_NOT_FOUND`, `DM_LIST_INCORRECT`, `DM_DEVICE_NOT_FOUND`) собираются в `vendor.errors`, группа сохраняется.

### `DeviceFileStorage`

Сохраняет состояние устройства (`device.storage`) на диск.

| Опция | По умолчанию |
|---|---|
| `storageDir` | `./storage` |

События:

- `service.start.begin` (первичный старт) → `dev.storage = loadDeviceStorage(id)`;
- `device.add` (hot add) → `dev.storage = loadDeviceStorage(id)`;
- `device.save` → `saveDeviceStorage(device, trace)`.

Файл: `storage/{containerId}/{deviceId}.json`. Сохранение: запись в `-tmp`, затем rename. Загрузка: если основного файла нет — берётся `-tmp`-резерв и переименовывается. Ошибка — `emit('system.error')`.

### `DeviceMetrics`

Хранит метрики устройств в базе `vrack-db`.

События:

- `device.metric.register` → `DB.metric({ name, retentions, tStorage, vStorage, CInterval })`;
- `device.metric` → `DB.write(path, value, 0, modify)`.

Путь метрики — `device.metricname` (нижний регистр). Методы: `has(device, name)`, `read(device, name, period, precision, func?)`.

### `StructureStorage`

Сохраняет структуру контейнера на диск.

| Опция | По умолчанию |
|---|---|
| `structureDir` | `./structure` |

События: `service.loaded` → `structureStorage()`.

Файл: `structure/{containerId}.json`. При записи сохраняется поле `display` из файла (если оно есть в файле). Методы: `getById(id)`, `updateById(id, structure)`.

### `BootDatabase` / `BootDatabaseSqlite` / `BootDatabaseMemory`

Общая база данных сервиса: один экземпляр на id, доступен всем устройствам через `Device.getDB()` (см. [03-Device](03-Device.md)). Это **единый** ресурс уровня процесса — не «база на устройство», а общая для всего контейнера.

Три класса из коробки:

| Класс | Бэкенд | Когда использовать |
|---|---|---|
| `BootDatabase` | Абстрактная база (машина состояний + транзакции) | Наследовать под свой драйвер/БД |
| `BootDatabaseSqlite` | SQLite (`node:sqlite`, встроено в Node ≥ 22.5) | Файловая БД без внешних зависимостей — основной вариант |
| `BootDatabaseMemory` | In-memory SQLite (наследуется от Sqlite, `file = ':memory:'`) | Тесты и throwaway-данные, не переживающие процесс |

Базовый класс владеет: машиной состояний (`pending → ready → closed`), гвардами публичных методов, переупаковкой ошибок драйвера в кодовые `BDB_*`, и **всей** логикой транзакций (`acquire()` → `BEGIN` → `fn(tx)` → `COMMIT`/`ROLLBACK` → `release()`). Адаптер реализует только контрактные методы `connect/disconnect/_query/_execute/acquire/release` (+ опционально `checkOptions`).

Опции `BootDatabaseSqlite`:

| Опция | По умолчанию |
|---|---|
| `file` | **обязательна** — путь к файлу БД (`':memory:'` допустим) |
| `wal` | `true` (WAL-режим журнала; не действует на in-memory и read-only) |
| `readOnly` | `false` |

Публичный API:

```ts
db.query(sql, params?)      // все строки
db.get(sql, params?)        // первая строка или undefined
db.execute(sql, params?)    // { affectedRows, insertId? }
await db.transaction(fn)     // fn получает tx-контекст; авто COMMIT/ROLLBACK
await db.ping()             // SELECT 1; бросает, если БД недоступна
```

Параметры — только позиционные (`?`). Ошибки: `BDB_NOT_READY` / `BDB_CLOSED` (жизненный цикл), `BDB_QUERY_FAILED` (ошибка драйвера), `BDB_BUSY` (одновременная транзакция на одном соединении), `BDB_TX_LOCKED` (вложенный `transaction()`), `BDB_TRANSACTION_FAILED` — полный список в [08-Errors](08-Errors.md).

Поведение:

- Старт — fail-fast: сбой `connect()` → сервис **не стартует** (`BDB_CONNECT_FAILED`); повторные попытки — за супервайзером.
- Остановка только через `Bootstrap.destroyAll()`: «закрыть одну БД» из device-кода нельзя (это общий ресурс).

## Стандартный список boot-классов

```ts
const bootstrapConfig = {
    DeviceManager:    { path: 'vrack2-core.DeviceManager',    options: { systemDir: process.cwd(), dir: './devices' } },
    DeviceFileStorage:{ path: 'vrack2-core.DeviceFileStorage',options: { storageDir: './storage' } },
    DeviceMetrics:    { path: 'vrack2-core.DeviceMetrics',    options: {} },
    StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: './structure' } },
}
```

## Слоевая конфигурация

Состав boot-классов можно перекрывать на четырёх слоях (приоритет снизу вверх; конструктор `MainProcess` мержит их в единый список через `mergeBootList()`):

| # | Слой | Где |
|---|---|---|
| 1 | Ядерные дефолты | `MainProcess.DEFAULT_BOOTLIST` |
| 2 | Файл сервиса | `bootstrap` в `service.json` (`IServiceStructure.bootstrap`) |
| 3 | Конф-файл | секция `bootstrap` конф-файла (`confFile`) |
| 4 | Аргумент конструктора | `MainProcess({ bootstrap })` |

Семантика записи (значение по id) в каждом из слоёв 2–4:

- запись **с `path`** — добавляет класс либо **полностью заменяет** запись нижнего слоя (включая `options`);
- запись **без `path`** — **поштучно** перекрывает `options` уже объявленного id (выигрывает верхний слой, остальные опции сохраняются). Id обязан быть объявлен в нижнем слое — иначе ошибка `BTSP_BAD_BOOTLIST`;
- **`null`** — удаляет id из итогового списка (даже если нижний слой его объявлял).

Входные слои `mergeBootList()` не мутируются; порядок первого появления id сохраняется. Типы: `IBootListConfig` (мапа id → запись/`null`), `IBootstrapEntry` (`path?` + `options`).

Пример — переопределение DeviceMetrics и отключение DeviceFileStorage из файла сервиса:

```json
{
  "devices": [],
  "connections": [],
  "bootstrap": {
    "DeviceMetrics": { "options": { "flushInterval": 30000 } },
    "DeviceFileStorage": null
  }
}
```

## Связанные документы

- Контейнер — [06-Container](06-Container.md)
- Метрики — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Ошибки — [08-Errors](08-Errors.md)