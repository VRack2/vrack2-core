# 10 — Standalone-запуск сервиса

> **Зачем читать:** запустить сервис vrack2-core вне полноценного рантайма VRack2 — в своём собственном Node-процессе или воркере.
> **Кому:** авторам сервисов, которым нужен независимый процесс/воркер.
>
> ← [09-Utils](09-Utils.md) · [Назад: 00-Overview](00-Overview.md) →

## Когда нужен standalone

Standalone-запуск — это сервис vrack2-core, работающий в своём собственном Node-процессе (или воркере), без внешнего VRack2-рантайма. Всё, что нужно: `vrack2-core`, директории устройств и конфиг сервиса.

## Минимальная структура проекта

```
myvapp/
├─ devices/
│  └─ myvendor/
│     ├─ list.json        # ["Lamp", "Counter"]
│     ├─ Lamp.js
│     └─ Counter.js
├─ storage/               # создаётся автоматически DeviceFileStorage
├─ structure/             # создаётся автоматически StructureStorage
├─ service.json
├─ index.js
└─ package.json
```

## `package.json`

```json
{
  "name": "myvapp",
  "type": "module",
  "scripts": {
    "start": "node ./index.js"
  },
  "dependencies": {
    "vrack2-core": "latest"
  }
}
```

## `devices/myvendor/list.json`

```json
["Lamp", "Counter"]
```

## Устройство `devices/myvendor/Lamp.js`

Полный пример устройства — [03-Device](03-Device.md). Минимальный:

```js
import { Device, Port, Rule, Metric } from 'vrack2-core'

export default class Lamp extends Device {
    checkOptions() {
        return {
            maxBrightness: Rule.number().integer().min(1).max(255).default(200),
        }
    }
    inputs()  { return { on: Port.standard() } }
    outputs() { return { status: Port.standard() } }
    metrics() { return { brightness: Metric.inS().retentions('1s:6h') } }

    process() { this.state = { on: false, brightness: 0 } }

    inputOn(data) {
        const on = typeof data === 'number' ? data > 0 : data === true
        this.state = { on, brightness: on ? this.options.maxBrightness : 0 }
        this.shares = this.state
        this.render()
        this.metric('brightness', this.state.brightness, 'last')
        this.ports.output.status.push(this.shares)
    }
}
```

## `service.json`

```json
{
  "devices": [
    { "id": "Lamp1", "type": "myvendor.Lamp", "options": { "maxBrightness": 180 } }
  ],
  "connections": []
}
```

Формат — `IServiceStructure`; см. [02-AppStructure](02-AppStructure.md).

## Точка входа `index.js`

Стандартный набор boot-классов — `DeviceManager`, `DeviceFileStorage`, `DeviceMetrics`, `StructureStorage` ([07-Bootstrap](07-Bootstrap.md)).

```js
import { ImportManager } from 'vrack2-core'

const id = 'myvapp'
const processFile = './service.json'
const MainProcessPath = 'vrack2-core.MainProcess'

async function run() {
    const service = ImportManager.importJSON(processFile)
    const MainProcess = await ImportManager.importClass(MainProcessPath)

    const mp = new MainProcess({
        id,
        service,
        bootstrap: {
            DeviceManager:     { path: 'vrack2-core.DeviceManager',    options: { dir: './devices' } },
            DeviceFileStorage: { path: 'vrack2-core.DeviceFileStorage',options: { storageDir: './storage' } },
            DeviceMetrics:     { path: 'vrack2-core.DeviceMetrics',    options: {} },
            StructureStorage:  { path: 'vrack2-core.StructureStorage', options: { structureDir: './structure' } },
        },
    })

    // Подписка на события (опционально)
    mp.Container.on('device.render', (e) => console.log('render', e.device, e.trace))
    mp.Container.on('device.metric', (e) => console.log('metric', e.device, e.data, e.trace.value))
    mp.Container.on('system.error',  (e) => console.error('system.error', e))

    await mp.run()

    // Пример: обращение к action устройства
    // await mp.Container.deviceAction('Lamp1', 'actionName', { ... })
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
```

Порядок запуска — [01-Architecture](01-Architecture.md) (каноническая последовательность).

## Запуск

```bash
npm run start
```

## Аккуратное завершение

`MainProcess.terminate()` — graceful-остановка сервиса: останавливает все работающие устройства (`stop()` + `await stopPromise()` у каждого). Структура, реестр устройств и файлы хранилища остаются на месте; процесс **не** убивается — что делать после `terminate()`, решает хост-код. Идемпотентна: повторный вызов — no-op. Падение хуков остановки — `CTR_DEVICE_STOP_ALL_EXCEPTION` (best-effort: остальные устройства останавливаются).

```js
// после mp.run():
process.on('SIGINT', async () => {
    try {
        await mp.terminate()
    } catch (e) {
        console.error('terminate error:', e)
        process.exit(1)
    }
    process.exit(0)
})
```

## Запуск в воркере

Используйте `UniversalWorker` ([09-Utils](09-Utils.md)) или `worker_threads` напрямую. Внутри воркера `index.js` идентичен; данные передаются через `workerData` / `VRACK2_WORKER_DATA`.

```js
// родительский процесс
import { UniversalWorker } from 'vrack2-core'
const w = new UniversalWorker({
    isolated: true,
    scriptPath: './index.js',
    workerData: { id: 'worker-1' },
})
w.on('message', (m) => console.log(m))
w.send({ hello: 'world' })
w.on('exit', () => console.log('worker exited'))
```

## Проверка работы

| Что проверить | Как |
|---|---|
| Сервис стартовал | `await mp.run()` не бросил ошибку. |
| Устройство зарегистрировано | `mp.Container.hasDevice('Lamp1')` → `true`. |
| Структура | `mp.Container.getStructure()` содержит `Lamp1`. |
| События | Подписки на `device.render` / `device.metric` / `system.error`. |
| Хранилище | `storage/{containerId}/{deviceId}.json` появилось после `dev.save()`. |
| Структура на диске | `structure/{containerId}.json` появилось после `serviceLoaded`. |

## Связанные документы

- Архитектура и последовательность — [01-Architecture](01-Architecture.md)
- Файловая структура — [02-AppStructure](02-AppStructure.md)
- Устройство — [03-Device](03-Device.md)
- Boot-классы — [07-Bootstrap](07-Bootstrap.md)
- Ошибки — [08-Errors](08-Errors.md)