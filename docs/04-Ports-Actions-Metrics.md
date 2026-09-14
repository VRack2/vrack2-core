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
Port.standart()   // @deprecated — используйте Port.standard()
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

### Динамические порты

```js
{
    'command%d': Port.return().dynamic(this.options.inputs)
}
```

Требования: в имени — `%d`; `count` — количество портов. Неверное имя — `CTR_INCORRECT_DYNAMIC_PN`; неверное имя порта в целом — `CTR_INCORRECT_PN`.

### Рантайм

Каждый порт — объект `DevicePort`: `id`, `type`, `required`, `connected`, `connections[]`, `bind`, `listens`.

`push(data)` на **выходном** порту: данные уходят через соединение во входной порт.

`push(data)` на **входном** порту:

1. если установлен `bind` (хендлер `inputX`) — вызывается он, и на этом всё;
2. если есть слушатели (`listens`) — данные передаются каждому, список слушателей очищается (одноразовый захват);
3. если порт подключён — данные уходят к устройствам на другом конце соединений; при единственном соединении возвращается его результат.

Если устройство остановлено (`running = false`, см. `Container.stopDevice()`) — входной порт данные не принимает (`push` отбрасывается). Не-запущенное (или ещё запускающееся) устройство остановленным **не считается** — его порты принимают данные, и старт-трафик (например, регистрация команд) проходит.

## Соединения

Соединение — строка:

```
"DevA.outputPort -> DevB.inputPort"
```

Правила:

- устройства и порты должны существовать — иначе `CTR_CONNECTION_DEVICE_NF` / `CTR_CONNECTION_PORT_NF`;
- **типы портов должны совпадать**: `standard ↔ standard`, `return ↔ return` — иначе `CTR_INCOMPATIBLE_PORTS`;
- неверный формат — `CTR_CONNECTION_INCORRECT`;
- у выходного порта может быть несколько соединений (fan-out).

Объявление:

- в `service.json` — `connections` или `devices[].connections` ([02-AppStructure](02-AppStructure.md));
- в рантайме — `Container.addConnection(conn)` (событие `connection`, обновление структуры, создание ссылки `DeviceConnect`).

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
- Для каждой action обязателен хендлер: action `test.action` → метод `actionTestAction`. При регистрации отсутствие проверяется (`CTR_DEVICE_ACTION_NF` / `CTR_DEVICE_ACTION_HANDLER_NF`).
- Вызов: `Container.deviceAction(device, 'action.name', data)` — устройство должно работать (`running`), иначе `CTR_DEVICE_STOPPED`; далее валидирует `requirements` и вызывает хендлер; результат возвращается вызывающему.
- `beforeAction(action, data)` вызывается перед каждой action.

## Метрики

Метрика — числовой временной ряд устройства, хранится в `vrack-db` (boot-класс `DeviceMetrics`).

### Объявление

```js
metrics() {
    return {
        count: Metric.inS()
            .retentions('1s:6h')
            .description('Current counter value'),
    }
}
```

| Метод | Значение |
|---|---|
| `Metric.inS()` / `inMs()` / `inUs()` | Минимальная единица времени: секунда / миллисекунда / микросекунда. |
| `retentions('5s:10m, 1m:2h, ...')` | Политика хранения: с какой точностью и как долго хранятся данные. Формат Graphite-стиля; по умолчанию `5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y`. |
| `timeStorage(StorageTypes.X)` | Тип хранения времени (по умолчанию `Uint64`). |
| `valueStorage(StorageTypes.X)` | Тип хранения значения (по умолчанию `Float`). |
| `description(text)` | Описание. |
| `additional(obj)` | Произвольные дополнительные данные. |

### Как работает

- При `registerDevice()` каждая метрика регистрируется: событие `device.register.metric` → `DeviceMetrics` создаёт её в `vrack-db` (путь — `device.metricname`, нижний регистр).
- Запись: `device.metric(path, value, modify)` → событие `device.metric` → `DB.write`. `modify`: `last` (по умолчанию), `first`, `max`, `min`, `avg`, `sum`. Запись незарегистрированной метрики игнорируется.
- Чтение: `DeviceMetrics.read(device, name, period, precision, func?)` — `period` вида `'now-6h:now'`, `precision` — `'15m'` или количество точек.
- Проверка существования: `DeviceMetrics.has(device, name)`.

## Связанные документы

- Валидация `requirements` — [05-Validator](05-Validator.md)
- Хранение метрик и storage — [07-Bootstrap](07-Bootstrap.md)
- Ошибки — [08-Errors](08-Errors.md)