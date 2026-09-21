# 02 — Структура приложения (AppStructure)

> **Зачем читать:** чтобы понимать, где лежит каждый файл сервиса: где устройства, где структура сервиса, где сохранённое состояние.
> **Кому:** авторам сервисов и интеграторам.
>
> ← [01-Architecture](01-Architecture.md) · [Далее: 03-Device](03-Device.md) →

## Как выглядит сервис в файлах

Всё, что нужно, чтобы запустить сервис, — в одной папке:

```
my-service/
├── devices/                    # устройства, сгруппированные по вендорам
│   └── myvendor/
│       ├── list.json           # список устройств в группе
│       ├── Counter.js          # класс устройства
│       └── Lamp.js
├── service.json                # структура сервиса
├── storage/                    # состояния устройств (пишет DeviceFileStorage)
│   └── {containerId}/
│       ├── Counter1.json
│       └── Lamp1.json
└── structure/                  # структура сервиса (пишет StructureStorage)
    └── {containerId}.json
```

Две части вы создаёте сами: папку `devices/` и файл `service.json`. Две части ведёт ядро во время работы: `storage/` и `structure/`.

## Вендор — группа устройств

**Вендор** — это папка с группой устройств внутри `devices/`: у неё свой `list.json` и по одному файлу на каждое устройство.

Тип устройства записывается как `vendor.Device`: `myvendor.Counter` читается как «устройство `Counter` в группе `myvendor`». `DeviceManager` по такому имени находит файл класса (`ImportManager.importClass('myvendor.Counter')`).

## `list.json` — список устройств в группе

Два формата:

```json
["Counter", "Lamp", "Tracker"]
```

```json
{ "Counter": "my/Counter", "Lamp": "my/Lamp" }
```

- **Массив** — имя устройства = имя файла в папке вендора (`Counter` → `devices/myvendor/Counter.js`).
- **Объект** — значение — путь к файлу относительно `devices/{vendor}/`.

Если файла устройства нет, группа всё равно загружается: ошибка попадает в поле `errors` группы (`DM_DEVICE_NOT_FOUND`), остальные устройства не страдают.

## `service.json` — структура сервиса

Структура сервиса — это какие устройства создать и как их соединить (термин и детали — [00-Overview](00-Overview.md)). Интерфейс — `IServiceStructure`:

```json
{
  "devices": [
    { "id": "Counter1", "type": "myvendor.Counter", "options": { "scale": 2 } },
    { "id": "Lamp1",    "type": "myvendor.Lamp",    "options": { "maxBrightness": 128 } }
  ],
  "connections": [
    "Counter1.result -> Lamp1.on"
  ]
}
```

| Поле | Тип | Что это |
|---|---|---|
| `devices[].id` | string | Уникальный id устройства в контейнере. Допустимые символы — `[a-zA-Z0-9_*-:]` (проверяется `Utility.isDeviceName`). |
| `devices[].type` | string | Тип устройства: `vendor.Device`. |
| `devices[].options` | object | Опции устройства; проверяются его `checkOptions()`. |
| `devices[].connections` | string[] | Соединения, относящиеся только к этому устройству (необязательно). |
| `connections` | string[] | Соединения уровня сервиса: `"устройство.выход -> устройство.вход"`. |
| `bootstrap` | object (необязательно) | Перекрывание списка boot-классов: мапа `id` → запись (`path` + `options`), запись без `path` или `null`. Семантика слоёв — [07-Bootstrap](07-Bootstrap.md), «Слоевая конфигурация». |

Опции можно переопределить **conf-файлом** (`confFile` в `MainProcess`): JSON той же формы, где по `id` переопределяются `options` (и `connections`). Не удалось прочитать файл — ошибка `CTR_CONF_EXTENDS_PROBLEM`. В том же файле секция `bootstrap` перекрывает состав boot-классов (слои — [07-Bootstrap](07-Bootstrap.md)).

## `storage/` — сохранённые состояния устройств

Boot-класс `DeviceFileStorage` сохраняет состояние устройства (`device.storage`) в файлы:

- Файл: `storage/{containerId}/{deviceId}.json`.
- Сохранение: `device.save()` → событие `device.save` → сначала запись во временный файл `{deviceId}-tmp.json`, затем переименование в основной — файл не может остаться «наполовину».
- Загрузка: по событию `beforeProcess` (первичный старт) и по `device.add` (горячее добавление); если основного файла нет, берётся `-tmp`-резерв.

Подробности — [07-Bootstrap](07-Bootstrap.md).

## `structure/` — сохранённая структура сервиса

Boot-класс `StructureStorage` сохраняет структуру контейнера (результат `Container.getStructure()`) в `structure/{containerId}.json` при каждом событии `serviceLoaded`: первичная загрузка и каждое горячее изменение.

Поле `display` устройства (настройки отображения) не теряется при перезаписи файла структуры.

Формат структуры — [06-Container](06-Container.md), § `getStructure()`.