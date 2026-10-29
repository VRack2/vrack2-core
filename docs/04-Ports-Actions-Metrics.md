# 04 — Порты, Actions, Метрики

> **Зачем читать:** знать, как объявлять порты, соединять устройства, описывать actions с requirements и метрики с retentions.
> **Кому:** авторам устройств.
>
> ← [03-Device](03-Device.md) · [Далее: 05-Validator](05-Validator.md) →

## Порты

### Виды

```js
Port.standard()   // стандартный порт: отправка/каст значения в другой порт
Port.return()     // return-порт: получение значения через соединение
```

Порт объявляется в `inputs()` / `outputs()`:

```js
inputs() {
    return {
        on: Port.standard().description('Turn on/off (number > 0 = on)'),
    }
}
```

### Модификаторы портов

| Метод | Значение |
|---|---|
| `description(text)` | Описание (для документации). |
| `requirement(rule)` | Правило `BasicType` как **рекомендация** для данных, проходящих через порт. Не валидируется, но используется в документации. |
| `dynamic(count)` | Пометить порт динамическим и указать количество. В имени обязательно `%d` — заменяется номером порта. |
| `return(rule)` (только ReturnPort) | Правило `BasicType` как **рекомендация** для возвращаемого значения. Не валидируется. |
| `noCapture()` (выходной порт) | Отключить событие `device.port` для этого выходного порта — его поток данных не виден снаружи (наблюдение/логгирование). По умолчанию каждый выходной порт **создаёт** `device.port` на каждый `push`; входные порты и так его не создают. Не трогает отдельный механизм одноразового захвата (`listens`). |

### Динамические порты

```js
{
    'command%d': Port.return().dynamic(this.options.inputs)
}
```

Требования: в имени — `%d`; `count` — количество портов. Неверное имя — `CONT_INCORRECT_DYNAMIC_PN`; неверное имя порта в целом — `CONT_INCORRECT_PN`.

### Рантайм

Каждый порт — объект `DevicePort`: `id`, `type`, `direct` (`'input'`/`'output'`), `noCapture`, `required`, `connected` (только чтение, выводится из `connections[]`), `connections[]`, `bind`, `listens`.

`push(data)` на **выходном** порту: данные уходят через соединение во входной порт. По умолчанию **также** создаётся событие `device.port` в контейнере — `{ device, data: имяПорта, trace: данные }` — точка наблюдения/логгирования потока. Модификатор `noCapture()` отключает это событие. Наблюдение **не-инвазивное**: данные всё равно уходят по соединениям.

`push(data)` на **входном** порту:

1. если установлен `bind` (хендлер `inputX`) — вызывается он, и на этом всё;
2. если есть слушатели (`listens`) — данные передаются каждому, список слушателей очищается (одноразовый захват);
3. если порт подключён — данные уходят к устройствам на другом конце соединений; при единственном соединении возвращается его результат.

Если устройство остановлено (`running = false` — геттер от статуса контейнера, `state = 'stopped'`, см. `Container.stopDevice()`) — входной порт данные не принимает (`push` отбрасывается). Не-запущенное (или ещё запускающееся, `state = 'registered'`) устройство остановленным **не считается** — его порты принимают данные, и старт-трафик (например, регистрация команд) проходит.

## Соединения

Соединение — строка:

```
"DevA.outputPort -> DevB.inputPort"
```

Правила:

- устройства и порты должны существовать — иначе `CONT_CONNECTION_DEVICE_NF` / `CONT_CONNECTION_PORT_NF`;
- **типы портов должны совпадать**: `standard ↔ standard`, `return ↔ return` — иначе `CONT_INCOMPATIBLE_PORTS`;
- неверный формат — `CONT_CONNECTION_INCORRECT`;
- у выходного порта может быть несколько соединений (fan-out).

Объявление:

- в `service.json` — `connections` или `devices[].connections` ([02-AppStructure](02-AppStructure.md));
- в рантайме — `Container.addConnection(conn)` (событие `service.connection`, обновление структуры, создание ссылки `DeviceConnect`).

Только проверка: `Container.checkConnection(conn)` → `ICheckResult` ([06-Container](06-Container.md)).

## Actions

Action — метод устройства, вызываемый извне (контейнером или хост-процессом):

```js
actions() {
    return {
        'set.value': Action.global()
            .requirements({
                value: Rule.number().required().description('New counter value'),
            })
            .returns({
                value: Rule.number().description('Current value'),
            })
            .description('Set the counter value directly'),
    }
}

actionSetValue(data) {
    this.count = data.value
    return this.count
}
```

| Модификатор | Значение |
|---|---|
| `requirements({...})` | Правила `BasicType` для входных параметров. **Проверяются при каждом вызове**: при любой ошибке action не выполняется (fail-closed). |
| `returns({...})` | Рекомендация для возвращаемого значения. **Не валидируется** — только для документации. |
| `description(text)` | Описание action. |

- Метод action принимает **ровно один объект**.
- Для каждой action обязателен хендлер: action `test.action` → метод `actionTestAction`. При регистрации отсутствие проверяется (`CONT_DEVICE_ACTION_NF` / `CONT_DEVICE_ACTION_HANDLER_NF`).
- Вызов: `Container.deviceAction(device, 'action.name', data)` — устройство должно работать (`running`), иначе `CONT_DEVICE_STOPPED`; далее валидирует `requirements`, эмитит `device.action.before` и вызывает хук `onBeforeAction()` (возврат `false` → `CONT_DEVICE_ACTION_VETOED`), после чего — хендлер; результат возвращается вызывающему.
- `onBeforeAction(action, data)` — хук, объявленный в `Device`, вызывается ядром в `deviceAction()` после валидации аргументов, перед хендлером action. Возвращает `true` (разрешить) или `false` (отменить action).

## Метрики

Метрика — числовой временной ряд устройства. По умолчанию хранится в `vrack2-journal-db`
(boot-класс `JournalDbMetrics`); как опциональная возможность сохранена старая реализация
на `vrack-db` (boot-класс `VrackDbMetrics`) — переключение делается в `service.json`
(ключ `bootstrap.DeviceMetrics`, см. [07-Bootstrap](07-Bootstrap.md)).

### Объявление

```js
metrics() {
    return {
        count: Metric.one().descriptions('Current counter value'),
        'boilers.*': Metric.group()
            .descriptions('Per-boiler metrics')
            .list({ temp: Metric.one().descriptions('Boiler temperature') }),
    }
}
```

| Элемент | Значение |
|---|---|
| `Metric.one()` | Объявление одной метрики (ключ — точное имя). |
| `Metric.group()` | Объявление группы (ключ — wildcard-паттерн, напр. `'boilers.*'`). `*` матчит один сегмент имени через точку. |
| `.descriptions(text)` | Описание (группы — общее; участники могут иметь своё). |
| `.additional(obj)` | Произвольные дополнительные данные. |
| `.list({ name: Metric.one() })` | Известные участники группы (не исчерпывающе: группа принимает любое имя по паттерну). |

Объявление — **только метаданные**: хранение, retention и единица времени
(всегда мс) принадлежат движку метрик, а не устройству. `retentions`,
`modify`, `vType`/`tType` из объявления **удалены**.

### Как работает

- Хранение: **одна таблица на сервис** — `metrics { ts, dev, met, value }` в `vrack2-journal-db` (`cluster: ['dev','met']`); retention — сервисный, опция boot-класса `JournalDbMetrics.retention` (по умолчанию `5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y`; одна пара `res:ttl` — чистый TTL без rollup).
- При `registerDevice()` объявления регистрируются: событие `device.metric.register` → движок запоминает точные пути и паттерны групп (известные участники группы разворачиваются в точные пути). Пер-метрических хранилищ не создаётся.
- Запись: `device.metric(name, value)` → событие `device.metric` → строка в общую таблицу (путь `device.name`, нижний регистр). **Любое имя пишется молча**: декларация — не разрешение; незарегистрированная метрика хранится без описания.
- Чтение: `JournalDbMetrics.read(device, name, period, precision, func?)` — полный контракт `vrack-db SingleDB.read`: `period` вида `'now-6h:now'`, `precision` — интервал (`'15m'`, `'5s'`) или **максимальное число точек** в ряду (10, 200, 1500; числовая строка `'600'` = те же 600 точек — API/WS-вызовчики часто шлют числа строками), `func` — `last | first | max | min | avg | sum` (по умолчанию `last`). Возвращает `{ relevant, start, end, rows }`: `start`/`end` — абсолютные границы в секундах (выровнены по сетке `precision`), `relevant` — метрика известна (объявлена или писалась), `rows` — **плотный ряд** `{ time, value }` (старые → новые), пустые бакеты — `value: null` (те же семантики агрегации, что `vrack-db MetricResult.aggregate`). Неправильный `period` / `precision` — кодированная ошибка пакета `vrack2-journal-db` (`vError` / `vShort`, напр. `INT_PERIOD_FORMAT`); неизвестный `func` — `RangeError`.
- Агрегация: `JournalDbMetrics.aggregate(device, name, period)` — всегда `avg` (у общей таблицы нет per-metric `modify`); `JournalDbMetrics.percentile(device, name, period, p)` — точные квантили по сырым строкам окна.
- Проверка существования: `JournalDbMetrics.has(device, name)` — объявлена (точно или участник группы) или писалась с запуска движка.
- Старая реализация `VrackDbMetrics` (на `vrack-db`, in-memory): retention задаётся **сервисно** (опция `retentions`), единица — всегда ms; точные объявления создают серии сразу, участники групп и незадекларированные имена — лениво при первой записи. API: `read(device, name, period, precision, func?)`.

## Связанные документы

- Валидация `requirements` — [05-Validator](05-Validator.md)
- Хранение метрик и storage — [07-Bootstrap](07-Bootstrap.md)
- Ошибки — [08-Errors](08-Errors.md)