# 06 — Контейнер (Container)

> **Зачем читать:** понимать, что хранит контейнер, как регистрируются устройства, как запускаются, как добавляются соединения и удаляются устройства.
> **Кому:** авторам устройств и хост-процессам.
>
> ← [05-Validator](05-Validator.md) · [Далее: 07-Bootstrap](07-Bootstrap.md) →

## Назначение

`Container` — место, где устройства живут и работают: хранит все устройства и их состояние, передаёт события между устройствами и наружу, выполняет действия устройств. Наследует `EventEmitter`.

Владеет:

- реестром устройств (`devices`) и их actions/метрик;
- живой структурой (`structure`);
- состоянием соединений (через `DevicePort` / `DeviceConnect`);
- запуском и остановкой устройств (`runStart` / `startDevice` / `stopDevice` / `stopAll`);
- статусами устройств (`deviceStatus`) — по записи `IDeviceStatus` на каждое зарегистрированное устройство.

Конфигурацией сервиса и созданием устройств не владеет — это `ServiceLoader` ([01-Architecture](01-Architecture.md), § «MainProcess + ServiceLoader»).

```ts
constructor(id: string, bootstrap: Bootstrap)
```

| Поле | Значение |
|---|---|
| `id` | Уникальный id сервиса/контейнера. |
| `devices` | `{ [id]: Device }` — реестр устройств. |
| `parent` | Родительский контейнер: если этот контейнер запущен другим контейнером, верхний (родительский) контейнер передаёт сюда себя — запущенный контейнер получает доступ к родителю. |
| `meta` | Произвольные метаданные контейнера, приходящие снаружи (от хоста, запускающего сервис). Контракт не зафиксирован — содержимое непрозрачное (opaque). |
| `Bootstrap` | Экземпляр boot-класса (один на контейнер). |
| `deviceActions` | `{ [id]: { [action]: BasicAction } }`. |
| `deviceMetrics` | `{ [id]: { [metric]: BasicMetric } }`. |
| `structure` | Живая структура `IContainerStructure`. |
| `started` | `Set<string>` — полностью стартованные устройства. |
| `deviceStatus` | `{ [id]: IDeviceStatus }` — систематизированные статусы устройств (см. «Статус устройства»). |

## Регистрация: `registerDevice(dev)`

Принимает устройство, **уже созданное и валидированное** (`ServiceLoader.createDevice()`), и:

1. кладёт в `devices` и создаёт запись структуры;
2. вызывает `dev.onRegister()` (порты ещё не созданы — здесь назначаются динамические хендлеры);
3. регистрирует actions: для каждой action обязан существовать метод `actionXxx` (`CONT_DEVICE_ACTION_NF`), снимок правила попадает в структуру;
4. `settings()` устройства → структура;
5. регистрирует метрики: для каждой — `emit('device.metric.register', { device, data, trace })` (boot-класс `DeviceMetrics` создаёт метрику в `vrack-db`);
6. создаёт входные порты: динамические раскрываются (`%d` → `1..count`, `CONT_INCORRECT_DYNAMIC_PN`), имя проверяется (`CONT_INCORRECT_PN`), **обязателен** хендлер `inputXxx` (`CONT_INPUT_HANDLER_NF`), хендлер биндится в `port.bind`;
7. создаёт выходные порты.

## Ступенчатый старт

### `runStart()`

Выполняется один раз на контейнер (страж `runStartAttempted`). Устройства, которые уже стартовали (например, через `startDevice()`), пропускаются — поэтому вызывать безопасно и после горячего добавления:

```
emit 'service.start.begin'
  → для каждого устройства (не в started): emit 'device.start', id; dev.onStart()
emit 'service.start.end'
emit 'service.startAsync.begin'
  → для каждого устройства (не в started): emit 'device.startAsync', id; await dev.onStartAsync(); started.add(id)
emit 'service.startAsync.end'
emit 'service.ready.begin'
emit 'service.ready'
```

Падение `onStart()` → `CONT_DEVICE_PROCESS_EXCEPTION`; `onStartAsync()` → `CONT_DEVICE_PROCESS_PROMISE_EXCEPTION` (вложенная ошибка — в `vAddErrors`).

### `startDevice(id)`

Старт одного зарегистрированного устройства: `onStart()` + `await onStartAsync()` + `started.add(id)`. Повторный вызов ничего не делает. Используется для горячего добавления. Неизвестное устройство — `CONT_DEVICE_NF`.

### `isStarted(id)`

`true`, если устройство прошло `onStart()` + `onStartAsync()`. После `stopDevice()` / `stopAll()` — `false` (устройство можно запустить снова через `startDevice()`).

### `isRunning(id)`

`true`, если устройство **не остановлено**: `state = 'registered'` (ещё не запускалось) или `started`. `false` для `stopped` и для id без записи статуса (удалённое или не зарегистрированное) — fail-closed. Источник геттера `Device.running`.

### Остановка: `stopDevice(id)` / `stopAll()`

Остановка **обратима**: устройство не разрушается и запускается снова через `startDevice()` (повтор `onStart()` + `onStartAsync()`, снова включаются порты и actions).

`stopDevice(id)`:

```
if (!(id in devices)) throw CONT_DEVICE_NF
if (!started.has(id)) return                      // уже остановлено — no-op (идемпотентно)
  → emit('device.stop', id)
  → dev.onStop()                                  // падение → CONT_DEVICE_STOP_EXCEPTION (исходная ошибка в vAddErrors)
  → await dev.onStopAsync()                       // падение → CONT_DEVICE_STOP_PROMISE_EXCEPTION
  → started.delete(id); state = 'stopped'          // отсюда running = false
```

`stopAll()`:

```
emit('service.stop.begin')
  → для каждого id в started, в ОБРАТНОМ порядке запуска: stopDevice(id)
     (падение одного не останавливает остальных — best-effort)
emit('service.stop.end')
→ если были падения: throw CONT_DEVICE_STOP_ALL_EXCEPTION (ошибки устройств — в vAddErrors)
```

Последствия остановки: входные порты устройства отбрасывают `push`-данные, `deviceAction()` отклоняется ошибкой `CONT_DEVICE_STOPPED`.

## Actions: `deviceAction(device, action, data)`

```
deviceAction('Counter1', 'set.value', { value: 42 })
  → проверка устройства (CONT_DEVICE_NF)
  → проверка started (CONT_DEVICE_STOPPED)         // остановленное устройство не выполняет actions
  → проверка action (CONT_DEVICE_ACTION_NF)
  → проверка хендлера (CONT_DEVICE_ACTION_HANDLER_NF)
  → Validator.validate(action.requirements, data)   // fail-closed
  → await dev.actionSetValue(data)                  // результат возвращается вызывающему
```

## Структура: `getStructure()`

Возвращает живую структуру `IContainerStructure`:

```ts
{
  [deviceId]: {
    id, type,
    actions: { [name]: IAction },          // снимки правил
    outputs: { [port]: [{ device, port }] },
    inputs:  { [port]: [{ device, port }] },
    ports:   Array<IDeviceStructurePort>,  // { port, direct: 'input'|'output', ...IPort }
    metrics: { [name]: IMetricSettings },
    settings: { [key]: any },
    display?: { header_bg?, body_bg?, group_bg?, is_rotated?, row?, col? }
  }
}
```

`display` — персональные настройки отображения; `StructureStorage` сохраняет её при перезаписи структуры ([07-Bootstrap](07-Bootstrap.md)).

## Соединения

### `addConnection(conn)`

Hot-соединение двух уже зарегистрированных портов:

```
"DevA.outputPort -> DevB.inputPort"
```

1. `checkConnectionCore(conn)` — парсинг и валидация:
   - синтаксис `->`, ровно 2 части, по 2–3 акта на стороне (`CONT_CONNECTION_INCORRECT`);
   - устройство на выходе существует (`CONT_CONNECTION_DEVICE_NF`);
   - выходной порт существует (`CONT_CONNECTION_PORT_NF`);
   - устройство на входе существует (`CONT_CONNECTION_DEVICE_NF`);
   - входной порт существует (`CONT_CONNECTION_PORT_NF`);
   - типы портов совпадают: `standard ↔ standard`, `return ↔ return` (`CONT_INCOMPATIBLE_PORTS`).
2. `emit('service.connection', cc)`;
3. `makeConnection(cc)` — запись в `structure[].outputs/inputs[]` + `new DeviceConnect(outPort, inPort)`.

### `checkConnection(conn)`

Только проверка, без событий и без `DeviceConnect`. Возвращает `ICheckResult`:

```ts
{ valid: true }
// или
{ valid: false, error: { code, message }, problems? }
```

## Удаление: `removeDevice(id)`

Удаление **необратимо** (в отличие от `stopDevice()`): устройство разрушается. Метод асинхронный (возвращает `Promise`) — при удалении работающего устройства его сначала останавливают:

```
if (!(id in devices)) throw CONT_DEVICE_NF
  → если started.has(id): await stopDevice(id)  // onStop() + await onStopAsync();
                                                 // падение хуков остановки → удаление прерывается (fail-closed),
                                                 // устройство остаётся в контейнере
  → dev.onDestroy()
  → отключение всех соединений (обе стороны, дедупликация по DeviceConnect)
  → удаление записи структуры + всех ссылок на устройство (у других устройств)
  → удаление из devices / deviceActions / deviceMetrics / started
  → emit('device.remove', id)
```

Файл хранилища устройства **остается** на диске намеренно.

## Доступ к устройствам

| Метод | Значение |
|---|---|
| `hasDevice(id)` | `true`, если устройство зарегистрировано. |
| `getDevice(id)` | Экземпляр устройства или `undefined`. |
| `deviceList()` | Массив id всех устройств. |
| `getDeviceStatus(id)` | Копия статуса устройства (`IDeviceStatus`) или `undefined`, если устройство не зарегистрировано. |
| `deviceStatusList()` | Копии статусов всех зарегистрированных устройств (для UI/мониторинга). |

## Статус устройства

Контейнер ведёт систематизированный статус каждого зарегистрированного устройства — тип `IDeviceStatus` (экспортируется из `vrack2-core`). Запись создаётся при регистрации и уничтожается вместе с устройством (`removeDevice()`); сообщения удалённого устройства статус не создают.

| Поле | Значение |
|---|---|
| `id`, `type` | Id и тип устройства (`vendor.Class`). |
| `state` | `'registered'` / `'started'` / `'stopped'` — единственное поле жизненного цикла; `Device.running` (геттер → `Container.isRunning(id)`) и started-множество от него выводятся и в статус не дублируются. |
| `since` | `Date.now()` последнего изменения статуса (мс). |
| `lastAlert`, `lastError` | Последнее сообщение alert/error — `{ data, trace, at }`; `null`, если не было. Для `device.terminate` попадает в `lastError` (`data` — имя action); `trace` всегда обычный объект. |
| `alertCount`, `errorCount` | Количество сообщений с момента регистрации (terminate считается ошибкой). |

Статус меняется, и при каждом изменении **полный снапшот** эмитится на канал `status` — событие `device.status`, конверт `{ device, data: 'status', trace: <IDeviceStatus> }`:

1. `registerDevice()` — начальный статус (`state = 'registered'`);
2. успешный `startDevice()` / `runStart()` — `state = 'started'`;
3. успешная `stopDevice()` — `state = 'stopped'`;
4. события `device.alert`, `device.error`, `device.terminate` — обновление `lastAlert`/`lastError` и счётчиков (устройство при этом продолжает работать).

Ошибки, **брошенные вызывающему** (actions, обработка портов), в статус не попадают — только то, что вылетело на каналы устройства, плюс переходы жизненного цикла. Снапшот внутри события — копия: его изменение не влияет на запись, возвращаемую `getDeviceStatus()`.

| Событие | Аргумент | Когда |
|---|---|---|
| `service.start.begin` / `service.start.end` | — | Ступенчатый старт (синхронная фаза `runStart()`). |
| `device.start` | `id` | Перед `onStart()` устройства. |
| `service.startAsync.begin` / `service.startAsync.end` | — | Ступенчатый старт (асинхронная фаза `runStart()`). |
| `device.startAsync` | `id` | Перед `onStartAsync()` устройства. |
| `service.ready.begin` / `service.ready` | — | Конец `runStart()` (сервис собран). |
| `device.stop` | `id` | При `stopDevice()` — **до** хуков `onStop()` / `onStopAsync()`. |
| `service.stop.begin` / `service.stop.end` | — | Начало / конец `stopAll()` (выдаются всегда, даже если остановленных устройств нет). |
| `service.connection` | `{ outputDevice, outputPort, inputDevice, inputPort }` | При `addConnection()`. |
| `device.remove` | `id` | При `removeDevice()`. |
| `device.metric.register` | `{ device, data, trace }` | При `registerDevice()`. |
| `device.status` | `{ device, data: 'status', trace: IDeviceStatus }` | Автоматический канал — при каждом изменении статуса устройства (см. «Статус устройства»). |
| `device.render` / `device.metric` / `device.save` / `device.error` / `device.terminal` / `device.notify` / `device.event` / `device.alert` / `device.terminate` | `{ device, data, trace, ... }` | Сообщения устройств. |
| `system.error` | `CoreError` | Boot-класс сообщил об ошибке. |
| `service.loaded` | — | Финализация структуры (ServiceLoader). |

## Связанные документы

- Устройство — [03-Device](03-Device.md)
- Порты, actions, метрики — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Boot-классы — [07-Bootstrap](07-Bootstrap.md)
- Ошибки — [08-Errors](08-Errors.md)
- Публичный API — [11-API](11-API.md) (полный список экспортов, включая `Container`, и статус депрекации)