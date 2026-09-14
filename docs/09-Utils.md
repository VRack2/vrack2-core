# 09 — Утилиты (Utils)

> **Зачем читать:** знать, какие вспомогательные классы даёт ядро и как они применяются (импорт классов, воркеры, реактивность).
> **Кому:** авторам устройств и интеграторам.
>
> ← [08-Errors](08-Errors.md) · [Далее: 10-Standalone](10-Standalone.md) →

## `Utility`

Внутренний помощник (не экспортируется публично).

| Метод | Значение |
|---|---|
| `isDeviceName(name)` | Проверяет id устройства: `/^[a-zA-Z0-9_*-:]+$/`. Используется в `ServiceLoader.createDevice()`. |
| `prettyFormat(value, options?)` | Красивое форматирование значения через `util.inspect` (глубина, цвета, переносы). `Error` → `stack`. |

## `ImportManager`

Импорт классов и файлов в VRack-стиле, работа с путями.

| Метод | Значение |
|---|---|
| `importClass('vendor.Class')` | Динамический импорт класса по пути `vendor.Class`. Ошибки: `IM_CLASS_PATH_ERROR`, `IM_CLASS_VENDOR_ERROR`, `IM_CLASS_ACT_ERROR`. |
| `importPath(raPath)` | Импорт по абсолютному/относительному пути. |
| `importJSON(filePath)` | Чтение и парсинг JSON-файла; `IM_FILE_NOT_FOUND`, `IM_JSON_INCORRECT`. |
| `importClassName('myvendor.Counter')` | Имя класса: `Counter`. |
| `importVendorName('myvendor.Counter')` | Имя вендора: `myvendor`. |
| `dirList(dir)` / `fileList(dir)` | Список директорий / файлов. |
| `isDir(path)` / `isFile(path)` | Проверка типа пути. |
| `tryJsonParse(raw)` | Парсинг JSON; `IM_JSON_INCORRECT`. |
| `systemPath()` | Текущая рабочая директория (`process.cwd()`). |
| `camelize('input.device.port')` | `inputDevicePort` (используется в `DevicePort`/`Device` для имён хендлеров). |

## `UniversalWorker`

Единый интерфейс над `worker_threads` и `child_process.fork`.

```ts
new UniversalWorker({
    isolated: true,      // true — child_process.fork (отдельный процесс)
                          // false — worker_threads (тот же процесс)
    scriptPath: './worker.js',
    workerData: { ... }
})

worker.send(msg)                       // отправка в воркер
worker.on('message' | 'exit' | 'error', handler)
worker.kill() / worker.terminate()
```

Сторона воркера (статические методы):

| Метод | Значение |
|---|---|
| `UniversalWorker.isMain` / `isForked` / `isChild` | Флаги контекста. |
| `getWorkerData()` | Данные, переданные при создании (workerData или `VRACK2_WORKER_DATA`). |
| `sendMessage(message)` | Отправка сообщения родителю. |
| `onMessage(handler)` | Подписка на сообщения родителя. |

`isolated: true` — форк (изолированный процесс, данные через env `VRACK2_WORKER_DATA`); `isolated: false` — `worker_threads` (общая память, `postMessage`).

## `ReactiveRef`

Простой реактивный ref (аналог Vue 3) для plain-объектов.

```ts
const state = new ReactiveRef({ user: { name: 'Alice' }, items: [1, 2] })

state.watch(() => console.log('изменилось'))

state.value.user.name = 'Bob'      // вызовет callback
state.value.items = [1, 2, 3]     // вызовет callback (переприсвоение)
state.value.items.push(4)         // НЕ вызовет (мутация массива не отслеживается)
delete state.value.user.name      // вызовет callback

state.set({ user: { name: 'Eve' } })  // полная замена (уведомляет)
state.unwatch()                     // отключение
```

- Глубокая реактивность вложенных plain-объектов; массивы отслеживаются только при переприсвоении.
- Уведомление только при реальном изменении значения (или удалении существующего свойства).
- `snapshot()` — глубокий снимок без прокси (безопасен для `structuredClone` / `postMessage`); сохраняет циклические ссылки; примитивы/Date/Map/классы не трогаются.