# 03 — Устройство (Device)

> **Зачем читать:** это справочник по авторству устройства: какие методы реализовать, какие свойства заполняет ядро, какие сообщения можно слать.
> **Кому:** авторам устройств.
>
> ← [02-AppStructure](02-AppStructure.md) · [Далее: 04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md) →

## Что такое устройство

Устройство — единица сервиса: класс, наследующий `Device` (экспортируется как `default`). Ядро не знает, что устройство делает; оно лишь вызывает объявленные lifecycle-методы и подключает объявленные порты, actions и метрики.

```js
import { Device } from 'vrack2-core'

export default class MyDevice extends Device {
    // ...
}
```

## Свойства (заполняет ядро)

| Свойство | Когда заполняется | Что это |
|---|---|---|
| `id` | конструктор | Уникальный id в контейнере (из `service.json`). |
| `type` | конструктор | `'vendor.Device'`. |
| `Container` | конструктор | Ссылка на контейнер: события и вызов действий устройства. |
| `options` | конструктор + `createDevice()` | Опции, проверенные `checkOptions()`. |
| `ports.input` / `ports.output` | `registerDevice()` | Объекты портов; `push(data)` — на выходных. |
| `storage` | `service.start.begin` / `device.add` | Персистентное состояние; сохраняется `save()`. |
 | `shares` | конструктор / `onRegister()` | Объект быстро-меняющихся данных (обычный объект); подкласс задаёт его обычным типизированным полем; устройство вызывает `render()` после изменения — событие `device.render`. |
| `running` | только чтение (геттер) | Состояние работы устройства — выводится из статуса контейнера (`deviceStatus[id].state` через `Container.isRunning(id)`), самим устройством **не управляется**. `false` только у остановленного (`stopped`) или удалённого устройства: его порты отбрасывают `push`, а actions отклоняются ошибкой `CTR_DEVICE_STOPPED`. Не-запущенное (`registered`) устройство остановленным **не считается** — `running = true`, его порты активны, и старт-трафик (например, регистрация команд) проходит. |

## Жизненный цикл

Порядок фиксирован ядром (полная последовательность — [01-Architecture](01-Architecture.md), § «Каноническая стартовая последовательность»):

1. `new MyDevice(id, type, Container)` — конструктор.
2. Копирование опций из конфига, вызов `prepareOptions()` — **подготовка опций до валидации** (производные значения, преобразования).
3. `Validator.validate(this.checkOptions(), this.options)` — валидация опций; при неудаче — `VR_NOT_PASS` (обёрнут в `CTR_ERROR_PREPARE_OPTIONS` → `CTR_ERROR_INIT_DEVICE`).
4. `Container.registerDevice()`:
    - `onRegister()` — **входная точка инициализации**: порты ещё не созданы, shares доступны; здесь назначаются функции для динамических портов;
   - проверка actions: для каждой action должен существовать хендлер;
    - регистрация метрик (событие `device.metric.register` на каждую);
   - создание входных/выходных портов; проверка и bind входных хендлеров.
5. Подключение соединений (`addConnection`).
6. `onStart()` — **входная точка старта работы**: выполнены все шаги выше; здесь стартует основная работа (таймеры, подписки, инициализация соединений).
7. `await onStartAsync()` — асинхронная инициализация, которую лоадер ждёт у всех устройств (например, инициализация файловых баз).

Остановка (обратима): `Container.stopDevice()` / `stopAll()` (а на уровне сервиса — `MainProcess.terminate()`) вызывает `onStop()`, затем `await onStopAsync()`, и переводит статус устройства в `stopped` (отсюда `running = false`). Устройство **не разрушается** — его можно запустить снова через `Container.startDevice()` (повторно выполняются `onStart()` + `onStartAsync()`, снова включаются порты и actions).

Завершение (необратимо): `onDestroy()` вызывается, когда устройство удаляется из работающего сервиса (`ServiceLoader.removeDevice()` → `Container.removeDevice()`). Если устройство работало — сначала выполняется остановка (`onStop()` + `onStopAsync()`), и только потом `onDestroy()`. При простом завершении процесса вызываться не будет.

| Метод | Асинхронный | Когда вызывается |
|---|---|---|
| `prepareOptions()` | нет | до проверки опций |
| `checkOptions()` | нет | возвращает правила опций |
 | `onRegister()` | нет | в `registerDevice()`, до старта |
 | `onStart()` | нет | в `runProcess()` / `startDevice()`, ступень 1 |
 | `onStartAsync()` | да | в `runProcess()` / `startDevice()`, ступень 2, awaited |
 | `onStop()` | нет | при остановке (`stopDevice()` / `stopAll()`), только если устройство работает |
 | `onStopAsync()` | да | при остановке, awaited, после `onStop()` |
 | `beforeAction(action, data)` | нет | хук, объявленный в `Device`; текущее ядро его **не вызывает** (резерв) |
 | `onDestroy()` | нет | при удалении устройства (после остановки, если оно работало) |

Состояния: `CREATED → RUNNING → STOPPED → RUNNING …` (остановка обратима), а из `RUNNING` / `STOPPED` / `CREATED` — `DESTROYED` (удаление необратимо). Управление состоянием — только за контейнером.

## Декларативные методы

```js
checkOptions(): { [key: string]: BasicType } {
    return {
        scale: Rule.number().integer().min(1).default(1).description('Multiplier for every tick'),
    }
}

inputs(): { [key: string]: BasicPort } {
    return { data: Port.standard().description('Tick input') }
}

outputs(): { [key: string]: BasicPort } {
    return { result: Port.standard().description('Current counter value') }
}

actions(): { [key: string]: BasicAction } {
    return {
        reset: Action.global().description('Reset counter to zero'),
        'set.value': Action.global().requirements({
            value: Rule.number().required().description('New counter value'),
        }),
    }
}

metrics(): { [key: string]: BasicMetric } {
    return {
        count: Metric.inS().retentions('1s:6h').description('Current counter value'),
    }
}

description(): string { return 'A simple counter' }

settings(): IDeviceSettings {
    return { channels: ['terminal', 'notify', 'event', 'action', 'alert', 'error', 'render', 'status'] }
}
```

Наименование хендлеров: порт входа `data` → метод `inputData`; action `set.value` → метод `actionSetValue` (преобразование — `ImportManager.camelize('input.' + name)` / `camelize('action.' + name)`).

## Сообщения устройства

Все сообщения идут через `makeEvent(type, data, trace, args)` → `Container.emit(type, { device, data, trace })`.

| Метод | Событие | Назначение |
|---|---|---|
| `terminal(data, trace, ...args)` | `device.terminal` | Вывод в терминал |
| `notify(data, trace, ...args)` | `device.notify` | Уведомление |
| `event(data, trace, ...args)` | `device.event` | Произвольное событие |
| `alert(data, trace, ...args)` | `device.alert` | Предупреждение |
| `error(data, trace, ...args)` | `device.error` | Ошибка устройства (`Error` в `trace` автоматически преобразуется в объект) |
| `render()` | `device.render` | Явный рендер: шлёт текущий `shares` (**живую ссылку** — подписчики считают read-only) |
| `save()` | `device.save` | Сохранить `storage` в файл |
| `metric(path, value, modify)` | `device.metric` | Записать метрику; `modify`: `last` (по умолчанию), `first`, `max`, `min`, `avg`, `sum` |
| `terminate(error, action)` | `device.terminate` | Сообщить о критической ошибке: устройство не может продолжать работу |

> **Не путайте:** `Device.terminate(error, action)` — это **сообщение** о критической ошибке (событие `device.terminate`); оно само по себе **не останавливает** устройство. Остановка устройства — `Container.stopDevice()` / `stopAll()`; graceful-остановка всего сервиса — `MainProcess.terminate()` (см. [01-Architecture](01-Architecture.md)).

Метод `settings()` объявляет каналы, которыми пользуется устройство — по умолчанию все: `terminal`, `notify`, `event`, `action`, `alert`, `error`, `render`, `status`.

Канал **`status`** — автоматический: устройство его не вызывает и в коде не обрабатывает. Контейнер сам ведёт систематизированный статус каждого устройства (состояние жизненного цикла, время последнего изменения, последний alert/error) и эмитит полный снапшот на событие `device.status` при каждом изменении — поля и триггеры описаны в [06-Container](06-Container.md), раздел «Статус устройства».

## База данных (`getDB()`)

Общая база данных сервиса — boot-класс, объявленный в секции `bootstrap` (см. [07-Bootstrap](07-Bootstrap.md)). Устройство обращается к ней через:

```ts
getDB(id = 'DB'): BootDatabase
```

- `id` — id boot-класса из bootstrap-списка; по умолчанию `'DB'`. Не объявлен → `BTSP_CLASS_ID_NOT_FOUND`.
- Возвращает **интерфейс** `BootDatabase`, а не конкретный адаптер: если нужны методы адаптера, возьмите его класс через `Container.Bootstrap.getBootClass()`.
- БД гарантированно запущена **до** `onStartAsync()` устройства (boot-классы завершают старт раньше устройств — [01-Architecture](01-Architecture.md)).
- Закрыть/остановить БД из устройства нельзя: это ресурс уровня процесса, останавливается только `Bootstrap.terminateAll()`. Проверка живости — `ping()` (бросает = нежива).

Публичный API: `query(sql, params?)` → строки · `get(sql, params?)` → первая строка или `undefined` · `execute(sql, params?)` → `{ affectedRows, insertId? }` · `transaction(fn)` — авто `COMMIT`, при ошибке в `fn` — `ROLLBACK` и `DB_TRANSACTION_FAILED` · `ping()`. Параметры только позиционные (`?`). Ошибки кодовые: [08-Errors](08-Errors.md).

```js
class Track extends Device {
    async onStartAsync() {
        const db = this.getDB()
        const row = await db.get('SELECT * FROM tracks WHERE id = ?', [this.options.id])
        this.shares.title = row && row.title
    }

    actionPlay() {
        return this.getDB().transaction(async (tx) => {
            await tx.execute('INSERT INTO listens (track_id, ts) VALUES (?, ?)', [this.id, Date.now()])
            await tx.execute('UPDATE tracks SET plays = plays + 1 WHERE id = ?', [this.id])
        })   // атомарно: либо обе записи, либо ни одной
    }
}
```

## Полный пример

Устройство `Counter` — реальный фикстур из тестов (`test/fixtures/devices/testkit/Counter.js`):

```js
import { Device, Port, Action, Rule, Metric } from 'vrack2-core'

export default class Counter extends Device {
    checkOptions() {
        return {
            scale: Rule.number().integer().min(1).default(1).description('Multiplier for every tick'),
        }
    }

    metrics() {
        return {
            count: Metric.inS().retentions('1s:6h').description('Current counter value'),
        }
    }

    inputs() {
        return { data: Port.standard().description('Tick input') }
    }

    outputs() {
        return { result: Port.standard().description('Current counter value') }
    }

    actions() {
        return {
            reset: Action.global().description('Reset counter to zero'),
            'set.value': Action.global()
                .requirements({
                    value: Rule.number().required().description('New counter value'),
                })
                .description('Set the counter value directly'),
        }
    }

    process() {
        this.count = this.storage.count ?? 0
        this.shares.count = this.count
    }

    inputData(data) {
        const delta = typeof data === 'number' && isFinite(data) ? data : 1
        this.count += delta * this.options.scale
        this.storage.count = this.count
        this.shares.count = this.count
        this.render()
        this.save()
        this.metric('count', this.count, 'max')
        this.ports.output.result.push(this.count)
    }

    actionReset() {
        this.count = 0
        this.storage.count = 0
        this.shares.count = 0
        this.render()
        this.save()
        this.ports.output.result.push(this.count)
        return this.count
    }

    actionSetValue(data) {
        this.count = data.value
        this.storage.count = this.count
        this.shares.count = this.count
        this.render()
        this.save()
        this.ports.output.result.push(this.count)
        return this.count
    }
}
```

## Динамические хендлеры

```js
addInputHandler('data', (data) => { /* ... */ })        // → inputData
addActionHandler('set.value', (data) => { /* ... */ })  // → actionSetValue
```

## Как работают `shares` и `render()`

`shares` — обычный объект. Подкласс объявляет его своим типизированным полем — начальное состояние + форма:

```ts
class MyDevice extends Device {
    shares = { data: 1, name: 'x' }          // начальное состояние + его форма

    work() {
        this.shares.data = 42
        this.render() // явный вызов — иначе событие не уйдёт
        // типизировано в IDE:
        const n: number = this.shares.data
    }
}
```

Без поля дефолт — пустой `{}`; записи в конструкторе/`onRegister()` тоже работают.

Поведение:

- Изменение `shares` (запись, новое свойство, `delete`, полная замена `this.shares = {...}`) **ничего не шлёт** — устройство вызывает `render()` после изменений.
- В событии `device.render` поле `trace` — **живая ссылка** на `shares`: подписчик обязан считать её read-only (мутация меняет состояние устройства) и клонировать сам (`structuredClone`) перед пересылкой за границу сериализации (postMessage, ответ воркера).
- В `shares` держите plain-данные: `Date`, `Map`, экземпляры классов — как есть, никакой обёртки нет.
- `render()` работает в любой момент жизненного цикла, в том числе после `removeDevice()`.

**Типизация `options` (TS).** Базовые `options` — `Record<string, any>`. Чтобы получить подсказки внутри класса, сузьте тип только декларацией — на рантайм это не влияет (`declare` не эмитит код):

```ts
type MyOptions = { scale: number }

class Counter extends Device {
    declare options: MyOptions

    work() { const s: number = this.options.scale }   // IDE подсказывает
}
```

## Связанные документы

- Порты, соединения, actions, метрики — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Валидация опций — [05-Validator](05-Validator.md)
- База данных (`getDB()`) и boot-классы — [07-Bootstrap](07-Bootstrap.md)
- Ошибки устройств — [08-Errors](08-Errors.md)