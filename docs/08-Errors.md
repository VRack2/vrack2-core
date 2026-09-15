# 08 — Ошибки (Error Manager, CoreError)

> **Зачем читать:** это **канонический** справочник кодов ошибок VRack2-core. Коды ошибок описываются **только здесь** (в других документах — только ссылки).
> **Кому:** всем: авторам устройств, boot-классов и хост-процессов.
>
> ← [07-Bootstrap](07-Bootstrap.md) · [Далее: 09-Utils](09-Utils.md) →

## Как устроены ошибки

Все ошибки ядра — `CoreError` (наследует `Error`) с устойчивыми полями:

| Поле | Значение |
|---|---|
| `vError` | `true` — признак VRack-ошибки. |
| `vShort` | Единственный канонический идентификатор ошибки (читаемый код, например `CTR_DEVICE_NF`) — им пользуются `isCode()` и документы. |
| `name` | Модуль-владелец (например, `Container`). |
| `message` | Описание, понятное человеку. |
| `vAdd` | Список дополнительных полей. |
| `vAddErrors` | Вложенные ошибки (`ErrorManager.make(...).add(err)`). |

Сериализация: `error.export()` / `error.import(obj)` — безопасная передача по сети (JSON); `getUnknownProperty(field)` — доступ к динамическим полям после импорта.

## `ErrorManager`

| Метод | Значение |
|---|---|
| `register(name, short, description, rules?)` | Регистрация ошибки (до создания). Повторная регистрация идентичной записи — без действия; другой записи с тем же short — `EM_CODE_EXISTS`. |
| `make(short, additional?)` | Создание экземпляра; неизвестный код — `EM_CODE_NOT_FOUND`. |
| `add(err)` (на `CoreError`) | Вложить ошибку в `vAddErrors`. |
| `convert(error)` | Преобразовать чужую ошибку в VRack-ошибку (`EM_ERROR_CONVERT`); VRack-ошибку возвращает как есть. |
| `isCode(error, short)` | `true`, если `vShort` совпадает с переданным short. |
| `isError(error)` | `true`, если объект — VRack-ошибка (экземпляр или сериализованная). |

При регистрации можно передать `rules` — словарь `{ поле: BasicType }` (например, `{ port: Rule.string(), device: Rule.string() }`). Rules **не валидируют** дополнительные данные; они документируют, какие динамические поля ожидает ошибка и каков их тип. Ключи фактических динамических полей экземпляр ошибки хранит в `vAdd` (заполняется при `make(short, additional)` и при `import()`).

**Правило fail-closed:** неожиданное исключение внутри валидации или обработчиков не проходит «тихо» — оно оборачивается в VRack-ошибку (`VR_VALIDATION_INTERNAL`), а исходная ошибка сохраняется в `vAddErrors`.

## Коды по модулям

### ErrorManager (`EM_*`)

| Код | Описание |
|---|---|
| `EM_CODE_EXISTS` | Регистрация другой записи с тем же short. |
| `EM_CODE_NOT_FOUND` | Код не зарегистрирован. |
| `EM_ERROR_CONVERT` | Преобразованная чужая ошибка. |

### Validator (`VR_*`)

| Код | Описание |
|---|---|
| `VR_NOT_PASS` | Валидация не пройдена; `problems[]` в дополнительных полях. |
| `VR_VALIDATION_INTERNAL` | Неожиданная ошибка внутри валидации. |
| `VR_TYPE_NOT_EXISTS` | Тип/правило не существует. |
| `VR_ERROR_REQUIRED` | Обязательное значение отсутствует. |
| `VR_IS_NOT_NUMBER` | Значение не число (включая `NaN`, `±Infinity`). |
| `VR_NUMBER_INTEGER` | Значение не целое. |
| `VR_NUMBER_MAX` | Число больше предела. |
| `VR_NUMBER_MIN` | Число меньше предела. |
| `VR_IS_NOT_STRING` | Значение не строка. |
| `VR_STRING_MAX_LENGTH` | Строка длиннее предела. |
| `VR_STRING_MIN_LENGTH` | Строка короче предела. |
| `VR_IS_NOT_BOOLEAN` | Значение не булево. |
| `VR_IS_NOT_ARRAY` | Значение не массив. |
| `VR_ARRAY_CONTENT_ERROR` | Ошибка валидации элемента массива. |
| `VR_IS_NOT_OBJECT` | Значение не объект (включая `null`). |
| `VR_ERROR_OBJECT_FIELDS` | Ошибка валидации полей объекта. |
| `VR_IS_NOT_FUNCTION` | Значение не функция. |

### Container (`CTR_*`)

| Код | Описание |
|---|---|
| `CTR_DEVICE_DUPLICATE` | Дубликат id устройства. |
| `CTR_DEVICE_NF` | Устройство не найдено в контейнере. |
| `CTR_DEVICE_ACTION_NF` | Action на устройстве не найдена. |
| `CTR_DEVICE_ACTION_HANDLER_NF` | Хендлер action не найден. |
| `CTR_DEVICE_PROCESS_EXCEPTION` | `process()` устройства выбросил исключение (вложено в `vAddErrors`). |
| `CTR_DEVICE_PROCESS_PROMISE_EXCEPTION` | `processPromise()` устройства выбросил исключение. |
| `CTR_DEVICE_STOP_EXCEPTION` | `stop()` устройства выбросил исключение (вложено в `vAddErrors`). |
| `CTR_DEVICE_STOP_PROMISE_EXCEPTION` | `stopPromise()` устройства выбросил исключение (вложено в `vAddErrors`). |
| `CTR_DEVICE_STOP_ALL_EXCEPTION` | В `stopAll()` не удалось остановить одно или более устройств (ошибки устройств — в `vAddErrors`). |
| `CTR_DEVICE_STOPPED` | Action вызвана на остановленном (не running) устройстве. |
| `CTR_DEVICE_PORT_NF` | Порт на устройстве не найден. |
| `CTR_INPUT_HANDLER_NF` | Хендлер порта входа не найден. |
| `CTR_INCORRECT_PN` | Неверное имя порта. |
| `CTR_INCORRECT_DYNAMIC_PN` | Неверное имя динамического порта (нет `%d`). |
| `CTR_CONNECTION_INCORRECT` | Неверный формат соединения. |
| `CTR_CONNECTION_DEVICE_NF` | Устройство соединения не найдено. |
| `CTR_CONNECTION_PORT_NF` | Порт соединения не найден. |
| `CTR_INCOMPATIBLE_PORTS` | Несовместимые типы портов. |
| `CTR_INCORRECT_BOOTSTRAP` | DeviceManager не указан корректно. |
| `CTR_IGNORE_SERVICE_AUTORELOAD` | Ошибка, игнорирующая флаг перезапуска сервиса. |

### ServiceLoader (`CTR_*`, префикс общий)

| Код | Описание |
|---|---|
| `CTR_CONF_EXTENDS_PROBLEM` | Ошибка расширения конфига сервиса (`confFile`). |
| `CTR_ERROR_INIT_DEVICE` | Ошибка инициализации устройства. |
| `CTR_ERROR_INIT_CONNECTION` | Ошибка инициализации соединения. |
| `CTR_ERROR_PREPARE_OPTIONS` | Ошибка подготовки опций устройства. |
| `CTR_INCORRECT_DEVICE_ID` | Неверный id устройства. |

### Bootstrap (`BTSP_*`)

| Код | Описание |
|---|---|
| `BTSP_CLASS_ID_NOT_FOUND` | Id boot-класса не найден. |
| `BTSP_INSTANCE_OF_INCORRECT` | Boot-класс не является экземпляром `BootClass`. |
| `BTSP_MUST_BE_BOOTCLASS` | Класс должен наследовать `BootClass`. |

### DeviceManager (`DM_*`)

| Код | Описание |
|---|---|
| `DM_DEVICE_NOT_FOUND` | Устройство не найдено. |
| `DM_LIST_NOT_FOUND` | `list.json` не найден. |
| `DM_LIST_INCORRECT` | `list.json` некорректен. |
| `DM_VENDOR_NOT_FOUND` | Вендор не найден. |
| `DM_GET_INFO_EXCEPTION` | Ошибка получения данных устройства. |

### StructureStorage (`SS_*`)

| Код | Описание |
|---|---|
| `SS_STRUCT_NOT_FOUND` | Структура по id не найдена. |

### ImportManager (`IM_*`)

| Код | Описание |
|---|---|
| `IM_FILE_NOT_FOUND` | Файл не найден. |
| `IM_JSON_INCORRECT` | JSON-файл некорректен. |
| `IM_CLASS_VENDOR_ERROR` | Путь класса не распознан (вендор не найден). |
| `IM_CLASS_PATH_ERROR` | Путь класса пуст — ни одной части. |
| `IM_CLASS_ACT_ERROR` | Часть пути класса не найдена. |

## Как проверять ошибки

```js
import { ErrorManager } from 'vrack2-core'

ErrorManager.isError(err)
ErrorManager.isCode(err, 'CTR_DEVICE_NF')
err.vShort === 'VR_NOT_PASS'
err.problems?.[0].type  // 'VR_ERROR_REQUIRED'
```

Вложенные ошибки — `err.vAddErrors` (массив).

## Связанные документы

- Валидатор — [05-Validator](05-Validator.md)
- Контейнер — [06-Container](06-Container.md)
- Boot-классы — [07-Bootstrap](07-Bootstrap.md)