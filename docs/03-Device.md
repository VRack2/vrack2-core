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
| `storage` | `beforeProcess` / `device.add` | Персистентное состояние; сохраняется `save()`. |
| `shares` | `attachSharesRender()` (после `preProcess()`) | Реактивный объект быстро-меняющихся данных; подкласс может задать его обычным типизированным полем, любое изменение вызывает событие `device.render`. |
| `running` | конструктор (`true`, как старый `works`); `stopDevice()` / `stopAll()` / `removeDevice()` (`false`); `startDevice()` / `runProcess()` — снова (`true`, **до** `process()`) | Состояние работы устройства — **управляется контейнером**, не устройством. `false` только у явно остановленного устройства: его порты отбрасывают `push`, а actions отклоняются ошибкой `CTR_DEVICE_STOPPED`. Не-запущенное (или ещё запускающееся внутри `process()`/`processPromise()`) устройство остановленным **не считается** — его порты активны, и старт-трафик (например, регистрация команд) проходит. |

## Жизненный цикл

Порядок фиксирован ядром (полная последовательность — [01-Architecture](01-Architecture.md), § «Каноническая стартовая последовательность»):

1. `new MyDevice(id, type, Container)` — конструктор.
2. Копирование опций из конфига, вызов `prepareOptions()` — **подготовка опций до валидации** (производные значения, преобразования).
3. `Validator.validate(this.checkOptions(), this.options)` — валидация опций; при неудаче — `VR_NOT_PASS` (обёрнут в `CTR_ERROR_PREPARE_OPTIONS` → `CTR_ERROR_INIT_DEVICE`).
4. `Container.registerDevice()`:
   - `preProcess()` — **входная точка инициализации**: порты ещё не созданы, shares доступны; здесь назначаются функции для динамических портов;
   - `attachSharesRender()` — дальше любое изменение `shares` автоматически шлёт `device.render`;
   - проверка actions: для каждой action должен существовать хендлер;
   - регистрация метрик (событие `device.register.metric` на каждую);
   - создание входных/выходных портов; проверка и bind входных хендлеров.
5. Подключение соединений (`addConnection`).
6. `process()` — **входная точка старта работы**: выполнены все шаги выше; здесь стартует основная работа (таймеры, подписки, инициализация соединений).
7. `await processPromise()` — асинхронная инициализация, которую лоадер ждёт у всех устройств (например, инициализация файловых баз).

Остановка (обратима): `Container.stopDevice()` / `stopAll()` (а на уровне сервиса — `MainProcess.terminate()`) вызывает `stop()`, затем `await stopPromise()`, и ставит `running = false`. Устройство **не разрушается** — его можно запустить снова через `Container.startDevice()` (повторно выполняются `process()` + `processPromise()`, снова включаются порты и actions).

Завершение (необратимо): `beforeTerminate()` вызывается, когда устройство удаляется из работающего сервиса (`ServiceLoader.removeDevice()` → `Container.removeDevice()`). Если устройство работало — сначала выполняется остановка (`stop()` + `stopPromise()`), и только потом `beforeTerminate()`. При простом завершении процесса вызываться не будет.

| Метод | Асинхронный | Когда вызывается |
|---|---|---|
| `prepareOptions()` | нет | до проверки опций |
| `checkOptions()` | нет | возвращает правила опций |
| `preProcess()` | нет | в `registerDevice()`, до auto-render |
| `process()` | нет | в `runProcess()` / `startDevice()`, ступень 1 |
| `processPromise()` | да | в `runProcess()` / `startDevice()`, ступень 2, awaited |
| `stop()` | нет | при остановке (`stopDevice()` / `stopAll()`), только если устройство работает |
| `stopPromise()` | да | при остановке, awaited, после `stop()` |
| `beforeAction(action, data)` | нет | перед каждой action |
| `beforeTerminate()` | нет | при удалении устройства (после остановки, если оно работало) |

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
| `render()` | `device.render` | Ручной рендер `shares` (авто — после `attachSharesRender`) |
| `sharesSnapshot()` | — | Глубокая plain-копия `shares` без реактивных прокси — для выхода за границу сериализации (ответы команд, postMessage, `structuredClone()`), где сам `this.shares` (Proxy) отклоняется |
| `save()` | `device.save` | Сохранить `storage` в файл |
| `metric(path, value, modify)` | `device.metric` | Записать метрику; `modify`: `last` (по умолчанию), `first`, `max`, `min`, `avg`, `sum` |
| `terminate(error, action)` | `device.terminate` | Сообщить о критической ошибке: устройство не может продолжать работу |

> **Не путайте:** `Device.terminate(error, action)` — это **сообщение** о критической ошибке (событие `device.terminate`); оно само по себе **не останавливает** устройство. Остановка устройства — `Container.stopDevice()` / `stopAll()`; graceful-остановка всего сервиса — `MainProcess.terminate()` (см. [01-Architecture](01-Architecture.md)).

Метод `settings()` объявляет каналы, которыми пользуется устройство — по умолчанию все: `terminal`, `notify`, `event`, `action`, `alert`, `error`, `render`, `status`.

Канал **`status`** — автоматический: устройство его не вызывает и в коде не обрабатывает. Контейнер сам ведёт систематизированный статус каждого устройства (состояние жизненного цикла, время последнего изменения, последний alert/error) и эмитит полный снапшот на событие `device.status` при каждом изменении — поля и триггеры описаны в [06-Container](06-Container.md), раздел «Статус устройства».

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

## Как работает `shares` (auto-render)

`shares` опирается на `ReactiveRef` (см. [09-Utils](09-Utils.md)). Реактивные accessors установлены на prototype базового класса, а в модели типов `shares` — обычное свойство; поэтому подкласс может объявить его своим типизированным полем — это легально и в TS:

```ts
class MyDevice extends Device {
    shares = { data: 1, name: 'x' }          // начальное состояние + его форма

    work() { const n: number = this.shares.data }   // типизировано в IDE
}
```

Механика: до `attachSharesRender()` (после `preProcess()`) поле-тень живёт как обычный объект — там можно уточнять состояние (`this.options` к этому моменту уже установлены). Затем Container импортирует его значение в реактивный ref и снимает тень. Без поля дефолт — пустой `{}` (записи в конструкторе/`preProcess()` тоже работают).

Поведение:

- Уведомление вызывают: запись в существующее свойство, добавление нового, `delete` свойства, полная замена `this.shares = {...}`, изменение вложенных plain-объектов (рекурсивно).
- **Массивы внутри `shares` НЕ отслеживаются**: `this.shares.list.push(x)` рендер не вызывает — переприсвойте массив целиком.
- Записи в `shares` внутри `preProcess()` рендер НЕ вызывают (watcher подключается позже).

**Типизация `options` (TS).** Базовые `options` — `Record<string, any>`. Чтобы получить подсказки внутри класса, сузьте тип только декларацией — на рантайм это не влияет (`declare` не эмитит код):

```ts
type MyOptions = { scale: number }

class Counter extends Device {
    declare options: MyOptions

    work() { const s: number = this.options.scale }   // IDE подсказывает
}
```
- В событии `device.render` поле `trace` — **снимок** `shares` на момент рендера: глубокая обычная копия без прокси (безопасно для `postMessage` / structured clone). Считать read-only.
- В `shares` держите plain-данные: `Date`, `Map`, экземпляры классов реактивностью не оборачиваются и передаются как есть.
- После `removeDevice()` авто-рендер отключается; явный `render()` продолжает работать.

## Связанные документы

- Порты, соединения, actions, метрики — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Валидация опций — [05-Validator](05-Validator.md)
- Ошибки устройств — [08-Errors](08-Errors.md)