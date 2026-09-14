# 05 — Валидатор (Validator)

> **Зачем читать:** понимать, как описываются правила опций, `requirements` и `returns`, как работает проверка и какие коды ошибок выдаёт.
> **Кому:** авторам устройств и всем, кто читает правила.
>
> ← [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md) · [Далее: 06-Container](06-Container.md) →

## Что такое валидатор

Валидатор — правила для данных и их проверка. Правила описываются цепочкой методов (`Rule.number().integer().min(1)...`), а проверяется всегда **объект**: каждое его свойство по своему правилу. Отдельное значение проверить нельзя — только свойство объекта:

```js
const rules = {
    scale: Rule.number().integer().min(1).default(1).description('Multiplier'),
}
Validator.validate(rules, { scale: 2 })   // true
Validator.validate(rules, {})             // scale: 1 (default)
Validator.validate(rules, { scale: 'x' }) // throw VR_NOT_PASS
```

Внутри VRack валидатор используется для:

- опций устройств — `checkOptions()` + `options` (в `createDevice()`);
- входных параметров action — `action.requirements` (в `deviceAction()`).

`returns` action и `requirement` порта — **только документация**, не валидируются.

## Базовые методы (BasicType)

| Метод | Значение |
|---|---|
| `required()` | Поле обязательно. Старый алиас `require()` — deprecated (вскоре будет удалён). |
| `default(value)` | Значение по умолчанию: если ключ отсутствует (`undefined`), записывается в объект. |
| `description(text)` | Описание поля. |
| `example(value)` | Пример допустимого значения. |
| `message(template)` | Шаблон сообщения об ошибке; плейсхолдеры: `{value}` `{example}` `{default}` `{description}`. |
| `export()` / `toJSON()` | Снимок правила (read-only). |

## Типы и их правила

| Тип | Конструктор | Дополнительные правила |
|---|---|---|
| Число | `Rule.number()` | `integer()`, `min(n)`, `max(n)`. Только конечные числа: `NaN`/`±Infinity` — `VR_IS_NOT_NUMBER`. |
| Строка | `Rule.string()` | `minLength(n)`, `maxLength(n)`. |
| Булево | `Rule.boolean()` | — |
| Массив | `Rule.array()` | `content(rule)` — правило для каждого элемента (сбор ошибок по индексу). |
| Объект | `Rule.object()` | `fields({...})` — вложенные правила свойств. Явный `null` отклоняется. |
| Функция | `Rule.function()` | — |
| Любое | `Rule.any()` | — (явный `null` принимается) |

## Как ведут себя `null` и `undefined`

- **Ключ отсутствует (`undefined`)**:
  - есть `default()` → значение записывается в объект;
  - правило `required()` → ошибка `VR_ERROR_REQUIRED`;
  - опциональное правило → поле пропускается (типовая проверка не выполняется).
- **Явный `null`** — «присутствующее» значение: типовые проверки (string, number, boolean, function, array, object) его отклоняют; `Rule.any()` принимает.
- **`NaN`, `Infinity`, `-Infinity`** — не числа.
- **Неожиданное исключение** внутри самого правила не теряется: оно попадает в отчёт как проблема `VR_VALIDATION_INTERNAL` (внутри `VR_NOT_PASS`).

## Результат

- Успех: `true`; объект при этом может быть дополнен `default`-значениями.
- Ошибка: выбрасывается исключение `VR_NOT_PASS` с отчётом `problems[]`: `{ type, code, fieldKey, description, rule, arg }`. У каждой проблемы `arg` — данные ошибки (например, `limit`, `key`, `index`).

## Примеры

```js
// Число с ограничениями
scale: Rule.number().integer().min(1).max(100).default(1)
    .description('Multiplier for every tick')

// Строка с длиной
name: Rule.string().minLength(1).maxLength(24)
    .default('').description('Device name')

// Массив строк
channels: Rule.array().content(
    Rule.string().default('').maxLength(24).description('Channel name')
)

// Вложенный объект
config: Rule.object().fields({
    host: Rule.string().required().description('Host name'),
    port: Rule.number().integer().min(1).max(65535).default(8080),
})

// Сообщение с шаблоном
Rule.number().description('My number')
    .message('{description} must be 1,2,3,4,5,6... not {value}')
```

## Где используется в ядре

| Место | Правила | Данные |
|---|---|---|
| `ServiceLoader.createDevice()` | `checkOptions()` устройства | `options` из конфига |
| `Container.deviceAction()` | `action.requirements` | аргументы action |

Полный список кодов ошибок валидатора (`VR_*`) — [08-Errors](08-Errors.md).

## Связанные документы

- Опции и `checkOptions()` — [03-Device](03-Device.md)
- Actions и `requirements` — [04-Ports-Actions-Metrics](04-Ports-Actions-Metrics.md)
- Ошибки — [08-Errors](08-Errors.md)