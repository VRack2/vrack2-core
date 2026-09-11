# Bootstrap Классы

**Bootstrap класс** — вспомогательный класс, который расширяет возможности контейнера VRack2 Core, не будучи частью контейнера. Bootstrap классы похожи на устройства — у них есть опции (`checkOptions()`) и методы жизненного цикла (`process()`, `processPromise()`) — но они не попадают внутрь контейнера: у них нет портов, соединений, действий, метрик и собственного хранилища, и их нельзя указать в файле сервиса.

Если контейнер — это «двигатель» сервиса, то Bootstrap классы — его «периферия»: реестр классов устройств, персистентность данных устройств, сохранение структуры сервиса и запись метрик в базу данных.

Ключевые свойства:

- Все Bootstrap классы наследуются от `BootClass` (`vrack2-core.BootClass`)
- Создаются классом `Bootstrap` по списку конфигурации
- Каждый Bootstrap класс получает ссылку на свой `Container` (поле `this.Container`), а контейнер хранит ссылку на `Bootstrap` (поле `Container.Bootstrap`)
- На один контейнер — один экземпляр `Bootstrap`
- Класс `MainProcess` обеспечивает правильный порядок создания и запуска всех компонентов

## Архитектура

```
MainProcess
│
├── Bootstrap ──────── Bootstrap классы (из конфигурации "bootstrap")
│     ├── DeviceManager      — реестр классов устройств (list.json вендоров)
│     ├── DeviceFileStorage  — хранилище устройств (директория storage/)
│     ├── StructureStorage   — структура сервиса (директория structure/)
│     └── DeviceMetrics      — метрики устройств (база vrack-db)
│
├── Container ──────── устройства, порты, соединения, события
│     └── .Bootstrap  (ссылка на Bootstrap)
│
└── ServiceLoader ──── создание устройств, hot add/remove, событие "serviceLoaded"
      └── использует DeviceManager для поиска классов устройств
```

Единственное место в коде ядра, которое требует Bootstrap класс, — `ServiceLoader.createDevice()`: он ищет `DeviceManager` через `Bootstrap.getBootClass('DeviceManager', DeviceManager)`. Из этого следует:

- **`DeviceManager` обязателен**: в списке должен быть класс с ID `DeviceManager`, и он должен быть экземпляром `DeviceManager` (или его наследника)
- Три остальных стандартных класса **не требуются** кодом — их отсутствие просто лишает сервис соответствующего функционала (хранилища, структуры, метрик). Их можно заменить собственными реализациями

## Порядок запуска

Все действия происходят в `MainProcess.run()`:

```ts
async run() {
    await this.check()                 // 1) Bootstrap-классы + ServiceLoader
    await this.Container.runProcess()  // 2) процессы устройств
}
```

**Шаг 1 — `Bootstrap.loadBootList(Container)`** (вызывается в `check()`):

1. Для каждого пункта списка конфигурации (в порядке списка):
   - класс загружается через `ImportManager.importClass(path)`
   - создается экземпляр: `new Class(id, type, Container, options)`
   - **в конструкторе** базовый `BootClass` выполняет `checkOptions()` и `Validator.validate()` — ошибка валидации опций немедленно прерывает загрузку (throw)
   - проверяется `instanceof BootClass`, иначе ошибка `BTSP_INSTANCE_OF_INCORRECT`
2. для **всех** классов вызывается `process()` (в порядке списка)
3. для **каждого** класса последовательно вызывается `await processPromise()` — bootstrap ждет завершения каждого

**Шаг 2 — `ServiceLoader.load()`**: событие `configure` → заполнение конфига → создание и регистрация устройств (классы находятся через `DeviceManager`) → установка соединений → событие `serviceLoaded`.

**Шаг 3 — `Container.runProcess()`**: событие `beforeProcess` (именно в этот момент `DeviceFileStorage` подгружает хранилище устройств) → `process()` каждого устройства → `processPromise()` каждого устройства → события `beforeLoaded` / `loaded`.

Важно: все подписки Bootstrap классов на события контейнера устанавливаются **до** запуска устройств и до первого события `serviceLoaded`.
## Класс `Bootstrap` (API)

`Bootstrap` — менеджер Bootstrap классов: хранит список конфигурации, создает экземпляры и предоставляет к ним доступ.

```ts
import { Bootstrap } from 'vrack2-core'

const config = {
    DeviceManager: { path: 'vrack2-core.DeviceManager', options: { dir: './devices' } },
    MyBoot: { path: 'myboot.MyBoot', options: { apiKey: '...' } }
}
const bs = new Bootstrap(config)
```

Формат списка описан интерфейсом `IBootListConfig` (объявлен в модуле `Bootstrap`):

```ts
{
    [ID: string]: {
        path: string        // путь к классу в стиле "module.ClassName"
        options: object     // опции для этого класса
    }
}
```

| Метод | Описание |
|---|---|
| `loadBootList(Container)` | загрузить все классы из списка и запустить их: `process()` всех, затем `processPromise()` каждого |
| `getBootClass(id, cs)` | вернуть экземпляр класса по ID; `cs` — ожидаемый класс, проверяется через `instanceof` |

- `loaded` — защищенная карта созданных экземпляров `{ ID: BootClass }`; доступ снаружи только через `getBootClass()`
- `id` экземпляра — ключ из списка конфигурации
- `type` экземпляра — последний сегмент пути (например, `'DeviceManager'` из `'vrack2-core.DeviceManager'`)

Пример `getBootClass()`:

```ts
import { DeviceManager } from 'vrack2-core'

const dm = container.Bootstrap.getBootClass('DeviceManager', DeviceManager)
const vendors = dm.getVendorList()
```

## `BootClass` — базовый класс

Все Bootstrap классы наследуются от `BootClass` и получают:

### Поля

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | уникальный идентификатор — ключ из списка конфигурации |
| `type` | `string` | имя класса в VRack-стиле (последний сегмент пути) |
| `Container` | `Container` | контейнер, для которого запускается класс |
| `options` | `object` | опции из списка конфигурации (валидируются правилами `checkOptions()`) |

### Конструктор

```ts
constructor(id: string, type: string, Container: Container, options: object)
```

Вызывается `Bootstrap`, а не пользователем. В конструкторе выполняется `checkOptions()` и валидация опций через `Validator.validate()`; значения по умолчанию (`Rule...default(...)`) подставляются именно в этот момент.

### Методы для переопределения

| Метод | Описание |
|---|---|
| `checkOptions()` | возвращает объект правил валидации опций (типы `Rule`). По умолчанию: `{}` — опции не валидируются |
| `process()` | синхронная точка входа для запуска класса. По умолчанию: ничего не делает |
| `processPromise()` | асинхронная точка входа; `Bootstrap` ждет завершения у всех классов. По умолчанию: ничего не делает |
| `error(error)` | отправить ошибку в контейнер: `Container.emit('system.error', error)` |


## Стандартные Bootstrap классы

### `DeviceManager` — реестр классов устройств

**Назначение**: знает о доступных устройствах. Сканирует директорию `dir`, находит вендоров (поддиректории), читает их `list.json` и формирует реестр `vendor.Device → путь к классу`. Используется `ServiceLoader` для поиска классов устройств при их создании.

**Исходный код**: `src/boot/DeviceManager.ts`. Путь в списке: `vrack2-core.DeviceManager`

**Опции**:

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `dir` | `string` | `'./devices'` | директория с вендорами (относительно `systemDir`) |
| `systemDir` | `string` | `ImportManager.systemPath()` | директория, из которой запущен VRack |

**Публичные методы**:

| Метод | Описание |
|---|---|
| `getVendorList()` | список имен вендоров |
| `getVendorDeviceList(vendor)` | список устройств вендора; бросает `DM_VENDOR_NOT_FOUND` |
| `get(device, updateList?)` | класс устройства по имени `vendor.Device`; при отсутствии — обновляет реестр и повторяет попытку; `DM_DEVICE_NOT_FOUND` |
| `getDeviceInfo(vendor, device)` | полная информация об устройстве (интерфейс `IDeviceInfo`: actions, metrics, inputs, outputs, options, description); для сбора создаётся временный экземпляр устройства |

**Особенности поведения**:

- `process()` вызывает `updateDeviceList()` — сканирует директорию и разбирает `list.json` (форматы списка — массив или объект, см. [Общая структура](./Structure.md#организация-устройств))
- ошибки чтения `list.json` **не бросаются**, а накапливаются в `vendorList[].errors` (`DM_LIST_NOT_FOUND`, `DM_LIST_INCORRECT`, `DM_DEVICE_NOT_FOUND`) — сервис может продолжить работу, а проблемные вендоры можно отследить по этой коллекции
- `get()` по умолчанию (`updateList = true`) пересобирает реестр при отсутствии устройства — это позволяет «подхватить» устройство, добавленное на диск после запуска

**Ошибки**: `DM_DEVICE_NOT_FOUND`, `DM_LIST_NOT_FOUND`, `DM_LIST_INCORRECT`, `DM_VENDOR_NOT_FOUND`, `DM_GET_INFO_EXCEPTION`

### `DeviceFileStorage` — хранилище устройств

**Назначение**: персистентность данных устройств (`device.storage`). Подгружает хранилище каждого устройства перед запуском его `process()` и сохраняет его при вызове `device.save()`.

**Исходный код**: `src/boot/DeviceFileStorage.ts`. Путь в списке: `vrack2-core.DeviceFileStorage`

**Опции**:

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `storageDir` | `string` | `'./storage'` | директория файлов хранилища (создается автоматически) |

**Подписанные события**:

| Событие | Действие |
|---|---|
| `beforeProcess` | для каждого устройства: `dev.storage = loadDeviceStorage(id)` |
| `device.add` | подгружает хранилище для hot-добавленного устройства |
| `device.save` | сохраняет данные устройства (`saveDeviceStorage`) |

**Методы**: `loadDeviceStorage(deviceId)`, `saveDeviceStorage(deviceId, trace)`

**Надежность записи**:

- файл: `{storageDir}/{ContainerID}/{DeviceID}.json`
- запись двухфазная: сначала данные пишутся во временный файл `{DeviceID}-tmp.json`, затем он переименовывается в основной — после сбоя основной файл не остается неполным
- при чтении, если основного файла нет, временный файл (если он есть) поднимается в основной


### `StructureStorage` — структура сервиса

**Назначение**: сохраняет текущую структуру контейнера (устройства, соединения, параметры `display`) в файл.

**Исходный код**: `src/boot/StructureStorage.ts`. Путь в списке: `vrack2-core.StructureStorage`

**Опции**:

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `structureDir` | `string` | `'./structure'` | директория файлов структур (создается автоматически) |

**Подписанное событие**: `serviceLoaded` — эмитится `ServiceLoader` после начальной загрузки и после каждого hot-изменения (добавление/удаление устройства, добавление соединения). На это событие `StructureStorage` сохраняет структуру **один раз** (а не по каждому внутреннему шагу загрузки).

**Методы**:

| Метод | Описание |
|---|---|
| `getById(id)` | прочитать структуру по ID контейнера; бросает `SS_STRUCT_NOT_FOUND`, если файла нет |
| `updateById(id, structure)` | обновить структуру по ID |

**Особенности**: при каждом сохранении файл перезаписывается из **живой** структуры контейнера (`Container.getStructure()`), при этом параметры `display` (визуальная настройка) берутся из **предыдущего** файла — они не теряются при перезагрузках.

**Ошибки**: `SS_STRUCT_NOT_FOUND`

### `DeviceMetrics` — метрики устройств

**Назначение**: регистрация и хранение метрик устройств в базе данных `vrack-db` (экземпляр `SingleDB`).

**Исходный код**: `src/boot/DeviceMetrics.ts`. Путь в списке: `vrack2-core.DeviceMetrics`

**Опции**: отсутствуют.

**Подписанные события**:

| Событие | Действие |
|---|---|
| `device.register.metric` | регистрирует метрику в базе (retentions, типы хранения, интервал) |
| `device.metric` | пишет значение метрики (если метрика уже зарегистрирована) |

**Методы**:

| Метод | Описание |
|---|---|
| `has(device, name)` | существует ли метрика в базе |
| `read(device, name, period, precision, func?)` | чтение временного ряда, например `read('Lamp1', 'brightness', 'now-1h:now', '1m', 'last')` |

**Особенности**:

- «путь» метрики в базе: `{device}.{name}` в нижнем регистре
- класс интервала выбирается по минимальной единице времени метрики: `'s'` → `Interval`, `'ms'` → `IntervalMs`, `'us'` → `IntervalUs`


## Настройка в MainProcess

`MainProcess` создает `Bootstrap` из опции `bootstrap`. Если она не задана, используется встроенный список по умолчанию:

```ts
bootstrap: {
    DeviceManager: { path: 'vrack2-core.DeviceManager', options: { storageDir: './storage' } },
    DeviceStorage: { path: 'vrack2-core.DeviceFileStorage', options: {} },
    StructureStorage: { path: 'vrack2-core.StructureStorage', options: {} },
    DeviceMetrics: { path: 'vrack2-core.DeviceMetrics', options: {} }
}
```

> Примечание: ключ `storageDir` у `DeviceManager` в списке по умолчанию — лишняя опция (это опция `DeviceFileStorage`). Валидатор проверяет только опции, объявленные в `checkOptions()`, поэтому неизвестные ключи просто игнорируются.

### Пример полной конфигурации

```ts
import { MainProcess, ImportManager } from 'vrack2-core'

const service = await ImportManager.importJSON('./service.json')

const mp = new MainProcess({
    id: 'containerID',
    service,
    bootstrap: {
        // ID "DeviceManager" обязателен — ServiceLoader ищет его именно по этому ID
        DeviceManager: {
            path: 'vrack2-core.DeviceManager',
            options: { dir: './devices' }
        },
        DeviceStorage: {
            path: 'vrack2-core.DeviceFileStorage',
            options: { storageDir: './storage' }
        },
        StructureStorage: {
            path: 'vrack2-core.StructureStorage',
            options: { structureDir: './structure' }
        },
        DeviceMetrics: {
            path: 'vrack2-core.DeviceMetrics',
            options: {}
        }
    }
})

await mp.run()
```

**Примечания**:

- **ID** — ключ в списке; `getBootClass('DeviceManager', ...)` ищет его по этому ID. ID `DeviceManager` должен указывать на класс `DeviceManager` (или его наследника)
- **path** — формат `module.ClassName`; `ClassName` должен быть **именованным экспортом** модуля (не только `default`), так как `ImportManager.importClass` идет по свойствам модуля по частям пути
- класс должен быть доступен как npm-модуль (или относительно `systemDir`)
- на каждый контейнер создается свой список Bootstrap классов


## Создание собственного Bootstrap класса

Все Bootstrap классы наследуются от `BootClass`. Минимальный рабочий пример:

```ts
// myboot/MyBoot.ts
import { BootClass, Rule } from 'vrack2-core'

export class MyBoot extends BootClass {

    checkOptions() {
        return {
            apiKey: Rule.string().require().description('API key'),
            host:   Rule.string().default('localhost').description('Address of the server')
        }
    }

    // Синхронная инициализация: подписки на события, структуры данных
    process() {
        this.Container.on('system.error', (err: Error) => {
            console.error('[MyBoot] system error', err)
        })
    }

    // Асинхронная инициализация: сеть, файлы. Bootstrap дождется завершения
    async processPromise() {
        const res = await fetch(`http://${this.options.host}/init`, {
            headers: { 'x-api-key': this.options.apiKey }
        })
        if (!res.ok) this.error(new Error('init failed'))
    }
}
```

Затем подключите его в списке `MainProcess`:

```ts
bootstrap: {
    MyBoot: { path: 'myboot.MyBoot', options: { apiKey: '...' } }
}
```

### Рекомендации

- Держите конструктор чистым: базовый конструктор `BootClass` выполняет `checkOptions()` и валидацию опций; всю инициализацию выносите в `process()` / `processPromise()`
- `process()` — для синхронной работы (подписки, состояния); `processPromise()` — для асинхронной (I/O, сеть). Не блокируйте `processPromise()` бесконечно — bootstrap ожидает ее завершения перед запуском контейнера
- Подписки на события контейнера делайте в `process()` — к моменту работы устройств все обработчики уже на месте
- Ошибки отправляйте в контейнер через `this.error(err)` (событие `system.error`)
- Не создавайте и не удаляйте устройства напрямую — используйте `ServiceLoader` (`addDevice` / `removeDevice`)
- Взаимодействуйте с контейнером через `this.Container` (устройства, события, `getStructure()`)


## Сравнение: Bootstrap класс vs устройство

| Критерий | Bootstrap класс | Устройство |
|---|---|---|
| Где находится | Вне контейнера (ссылка на `Container`) | Внутри контейнера |
| Создание | `Bootstrap.loadBootList()` | `ServiceLoader.load()` |
| Опции | `checkOptions()` (валидация в конструкторе) | `checkOptions()` + `prepareOptions()` |
| События | Подписывается на события контейнера | Эмитит/принимает события устройства |
| Порты / соединения | Нет | Есть |
| Действия (`actions`) | Нет | Есть |
| Метрики | Нет | Есть |
| Жизненный цикл | `process()` / `processPromise()` | `process()` / `processPromise()` |
| Заменяемость | Любой класс с тем же `path` | Зависит от `DeviceManager` |

## События, на которые подписываются стандартные классы

| Bootstrap класс | Событие контейнера | Что делает |
|---|---|---|
| `DeviceFileStorage` | `beforeProcess` | подгружает `storage` каждого устройства |
| `DeviceFileStorage` | `device.add` | подгружает `storage` для hot-устройства |
| `DeviceFileStorage` | `device.save` | сохраняет `storage` устройства |
| `StructureStorage` | `serviceLoaded` | сохраняет структуру контейнера |
| `DeviceMetrics` | `device.register.metric` | регистрирует метрику в базе |
| `DeviceMetrics` | `device.metric` | пишет значение метрики |

> `DeviceManager` не подписывается на события контейнера — он работает «по запросу» из `ServiceLoader` при создании устройств.

## Коды ошибок

| Код | Класс | Ситуация |
|---|---|---|
| `BTSP_CLASS_ID_NOT_FOUND` | `Bootstrap` | `getBootClass()`: ID отсутствует в загруженных |
| `BTSP_INSTANCE_OF_INCORRECT` | `Bootstrap` | экземпляр не является ожидаемым классом |
| `BTSP_MUST_BE_BOOTCLASS` | `Bootstrap` | класс не наследуется от `BootClass` |
| `DM_DEVICE_NOT_FOUND` | `DeviceManager` | устройство не найдено в реестре |
| `DM_LIST_NOT_FOUND` | `DeviceManager` | `list.json` вендора не найден |
| `DM_LIST_INCORRECT` | `DeviceManager` | `list.json` имеет некорректный формат |
| `DM_VENDOR_NOT_FOUND` | `DeviceManager` | вендор не найден |
| `DM_GET_INFO_EXCEPTION` | `DeviceManager` | ошибка при сборе информации об устройстве |
| `SS_STRUCT_NOT_FOUND` | `StructureStorage` | файл структуры не найден по ID |

Все коды формируются через `ErrorManager` и обрабатываются единообразно (см. `CoreError`).

## Связанные документы

- [Общая структура](./Structure.md)
- [Контейнер](./Container.md)
- [Быстрый старт](./FastStart.md)

