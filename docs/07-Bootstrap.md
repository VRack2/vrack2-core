# 07 — Bootstrap и boot-классы

> **Зачем читать:** понимать, как расширяется контейнер «сверху»: что такое boot-класс, как он загружается, и что делают четыре стандартных boot-класса (устройства, хранилище, метрики, структура).
> **Кому:** интеграторам и авторам boot-классов.
>
> ← [06-Container](06-Container.md) · [Далее: 08-Errors](08-Errors.md) →

## Что такое boot-класс

Boot-класс — служебный модуль, работающий **вместе с** контейнером: слушает его события и оказывает вспомогательные услуги — сохраняет состояние устройств на диск, пишет метрики в базу, ведёт реестр доступных устройств.

В отличие от устройства boot-класс не является частью сервиса: у него нет портов, соединений и структуры. Он живёт вне контейнера, поэтому его можно заменить своей реализацией, не трогая устройства. Пример: `DeviceManager` — нужен для запуска сервиса, но заменяемый и настраиваемый.

Каждый boot-класс создаётся один раз на контейнер (внутри `Bootstrap`) и общается с контейнером через события (`on` / `emit`).

## `BootClass` API

```ts
class MyBoot extends BootClass {
    id: string                 // уникальный id из списка
    type: string               // путь к классу, 'vendor.MyBoot'
    Container: Container       // контейнер, для которого загружен
    options: object            // опции из списка (валидируются)

    checkOptions(): { [key: string]: BasicType } { ... }  // правила опций
    process() { }               // входная точка старта (синхронная)
    async processPromise() { }  // асинхронный старт (лоадер ждёт всех)
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
```

`loadBootList(Container)`:

```
для каждого класса из config:
  ExClass = await ImportManager.importClass(path)
  loaded[id] = new ExClass(id, importClassName(path), Container, options)
  if (!(loaded[id] instanceof BootClass)) throw BTSP_INSTANCE_OF_INCORRECT

для каждого загруженного: process()
для каждого загруженного: await processPromise()
```

Ошибки: `BTSP_CLASS_ID_NOT_FOUND`, `BTSP_INSTANCE_OF_INCORRECT`, `BTSP_MUST_BE_BOOTCLASS`.

## Четыре стандартных boot-класса

> **Важно:** `DeviceManager` — единственная **обязательная** запись: `ServiceLoader.createDevice()` ищет его по id (`Bootstrap.getBootClass('DeviceManager', DeviceManager)`), без него сервис с устройствами не запустится. Три остальных — необязательны: без `DeviceFileStorage` нет сохранения состояний, без `DeviceMetrics` — метрик в `vrack-db`, без `StructureStorage` — структуры на диске. Каждый можно заменить своей реализацией.

### `DeviceManager`

Реестр устройств: сканирует `devices/` и предоставляет доступ к классам.

| Опция | По умолчанию |
|---|---|
| `dir` | `./devices` |
| `systemDir` | `ImportManager.systemPath()` |

Методы: `getVendorList()`, `getVendorDeviceList(vendor)`, `getDeviceInfo(vendor, device)`, `get(device)` (возвращает класс устройства).

При `process()` — `updateDeviceList()`: для каждого вендора читает `list.json` (массив или объект); ошибки (`DM_LIST_NOT_FOUND`, `DM_LIST_INCORRECT`, `DM_DEVICE_NOT_FOUND`) собираются в `vendor.errors`, группа сохраняется.

### `DeviceFileStorage`

Сохраняет состояние устройства (`device.storage`) на диск.

| Опция | По умолчанию |
|---|---|
| `storageDir` | `./storage` |

События:

- `beforeProcess` (первичный старт) → `dev.storage = loadDeviceStorage(id)`;
- `device.add` (hot add) → `dev.storage = loadDeviceStorage(id)`;
- `device.save` → `saveDeviceStorage(device, trace)`.

Файл: `storage/{containerId}/{deviceId}.json`. Сохранение: запись в `-tmp`, затем rename. Загрузка: если основного файла нет — берётся `-tmp`-резерв и переименовывается. Ошибка — `emit('system.error')`.

### `DeviceMetrics`

Хранит метрики устройств в базе `vrack-db`.

События:

- `device.register.metric` → `DB.metric({ name, retentions, tStorage, vStorage, CInterval })`;
- `device.metric` → `DB.write(path, value, 0, modify)`.

Путь метрики — `device.metricname` (нижний регистр). Методы: `has(device, name)`, `read(device, name, period, precision, func?)`.

### `StructureStorage`

Сохраняет структуру контейнера на диск.

| Опция | По умолчанию |
|---|---|
| `structureDir` | `./structure` |

События: `serviceLoaded` → `structureStorage()`.

Файл: `structure/{containerId}.json`. При записи сохраняется поле `display` из файла (если оно есть в файле). Методы: `getById(id)`, `updateById(id, structure)`.

## Стандартный список boot-классов

```ts
const bootstrapConfig = {
    DeviceManager:    { path: 'vrack2-core.DeviceManager',    options: { systemDir: process.cwd(), dir: './devices' } },
    DeviceFileStorage:{ path: 'vrack2-core.DeviceFileStorage',options: { storageDir: './storage' } },
    DeviceMetrics:    { path: 'vrack2-core.DeviceMetrics',    options: {} },
    StructureStorage: { path: 'vrack2-core.StructureStorage', options: { structureDir: './structure' } },
}
```

## Связанные документы

- Контейнер — [06-Container](06-Container.md)
- Метрики — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Ошибки — [08-Errors](08-Errors.md)