# Опечатки в КОДЕ (API / методы / строки) — `vrack2-core/src`

> Только фиксация, **без исправлений**. Это реальный код (идентификаторы, коды ошибок,
> строковые значения) — в отличие от комментариев, которые уже поправлены отдельно.
> Дата: 08.09.2026

Легенда: **Было → Стало** (рекомендуемое исправление).

---

## 1. Идентификаторы: классы / методы / интерфейсы / файлы

| # | Файл | Было | Решение | Статус |
|---|------|------|---------|--------|
| 1 | `src/ports/StandartPort.ts` | `class StandartPort` | создан новый `StandardPort` (`StandardPort.ts`); старый `StandartPort` → `@deprecated` | ✅ |
| 1а | `src/ports/StandartPort.ts` | файл `StandartPort.ts` | создан новый файл `StandardPort.ts`; старый файл сохранён (deprecated) | ✅ |
| 2 | `src/ports/Port.ts` | `static standart()` | добавлен `static standard()` → `new StandardPort()`; старый `standart()` → `@deprecated` | ✅ |
| 3 | `src/service/Device.ts` | `Port.standart()` в примерах (комменты 209-210) | примеры переведены на `Port.standard()` | ✅ |
| 4 | `src/boot/DeviceManager.ts` | 52, 171, 178 | `interface IDeivceInfo` | `IDeviceInfo` | ✅ |
| 5 | `src/boot/DeviceMetrics.ts` | 20, 30, 69, 74 | `deviceRegiterMetric(...)` | `deviceRegisterMetric(...)` | ✅ |

---

## 2. Коды ошибок (в `ErrorManager.register` / `ErrorManager.make`) — ✅ ИСПРАВЛЕНО

| # | Файл | Строка(ы) | Было | Стало | Статус |
|---|------|-----------|------|-------|--------|
| 6 | `src/Container.ts` | 36, 406 | `CTR_DEVICE_DUBLICATE` | `CTR_DEVICE_DUPLICATE` | ✅ |
| 7 | `src/Container.ts` | 107 | `CTR_INCORRECT_BOOSTRAP` | `CTR_INCORRECT_BOOTSTRAP` | ✅ |
| 8 | `src/validator/types/BasicType.ts` | 133, 138 | `VR_ERROR_REQUAERED` | `VR_ERROR_REQUIRED` | ✅ |

---

## 3. Строки-сообщения (значения в runtime) — ✅ ИСПРАВЛЕНО

| # | Файл | Строка | Было | Стало | Статус |
|---|------|--------|------|-------|--------|
| 9 | `src/Container.ts` | 36 | `'Device id is dublicated'` | `'Device id is duplicated'` | ✅ |
| 10 | `src/Container.ts` | 554 | `'... syntax have -> beetwen device'` | `'between'` | ✅ |
| 11 | `src/Container.ts` | 559 | `'... more 3 actets on side'` | `'acts'` | ✅ |
| 12 | `src/Container.ts` | 560 | `'... less 2 actets on side'` | `'acts'` | ✅ |
| 14 | `src/validator/types/BooleanType.ts` | 48 | `'Value must be a number'` (для `VR_IS_NOT_BOOLEAN`) | `'Value must be a boolean'` | ✅ |

> ~~13. `src/validator/Validator.ts` — `'Validation faild'`~~ — **ошибочная запись**, такой строки нет.
> Реальное сообщение в `Validator.ts:21`: `'Validation error - data not pass'` (грамматика — см. раздел 5).

---

## 4. Подозрительные несоответствия (не прямые опечатки, но стоит проверить)

| # | Файл | Строка | Что не так | Комментарий |
|---|------|--------|------------|-------------|
| 15 | `src/boot/DeviceManager.ts` | 145 | код `IM_DEVICE_METRIC_NF` в компоненте `'DeviceManager'` | префикс `IM_` — у ImportManager; для DeviceManager логичнее `DM_` |
| 16 | `src/Container.ts` | 47 | код `CTR_DEVICE_NF` (NF = not found), а сообщение `'Device in container found'` | сообщение противоречит коду, скорее всего должно быть `'... not found'` |
| 17 | `src/metrics/IvMs.ts`, `IvS.ts`, `IvUs.ts` | 3 | импорт `import BasicInterval from "./BasicMetric"` | псевдоним `BasicInterval` для класса `BasicMetric` — сбивает с толку |
| 18 | `src/metrics/IvMs.ts` / `IvS.ts` / `IvUs.ts` | 13 / 13 / 12 | имена `IvMS` / `IvS` / `IvUs` | непоследовательный регистр (`MS` vs `S` vs `Us`) |

---

## 5. Грамматика в строках (английский, `a`/`an` и т.п.) — ✅ ЗАКРЫТО

| # | Файл | Было | Стало | Статус |
|---|------|------|-------|--------|
| 19 | `src/validator/types/ArrayType.ts:97` | `'Value must be a array'` | `'Value must be an array'` | ✅ |
| 20 | `src/boot/DeviceManager.ts` | `'Device list must be a array'` | — | ❌ ложная запись: строки нет в коде |
| 21 | `src/validator/types/ObjectType.ts:90` | `'Value must be a object'` | `'Value must be an object'` | ✅ |
| 22 | `src/validator/types/NumberType.ts:113` | `'Value must be a integer'` | `'Value must be an integer'` | ✅ |
| 23 | `src/validator/Validator.ts` | `'object should be a object'` | — | ❌ ложная запись: строки нет в коде |
| 24 | `src/errors/ErrorManager.ts` | `'Error code is already exists'` | — | ❌ ложная запись: строки нет в коде |
| 25 | `src/boot/BootClass.ts` | `'not a instance of a BootClass'` | — | ❌ ложная запись: строки нет в коде |
| 26 | `src/Container.ts` | `'Configuration must be a object'` | — | ❌ ложная запись: строки нет в коде |

> Проведён дополнительный проход по всему `src/` на a/an-ошибки (a+гласная, an+согласная, двойной артикль) — других случаев **нет**. Раздел закрыт полностью.

---

### Итого
- Прямых опечаток в коде: **13** (разделы 1–2 + строки).
  - Раздел 1 (идентификаторы): **✅ исправлено**.
    - `IDeviceInfo`, `deviceRegisterMetric` — переименованы без потерь.
    - Кластер `StandartPort` — добавлены `StandardPort` + `Port.standard()`, старые помечены `@deprecated`. Оба класса (`StandartPort` и `StandardPort`) теперь выводят `type: 'standard'` (по решению; взаимно совместимы, наружное значение изменено с `'standart'` на `'standard'`).
    - Примеры `Port.standart()` в комментариях `Device.ts:209-210` — ✅ переведены на `Port.standard()`.
  - Раздел 2 (коды ошибок): **3 — ✅ исправлено**.
  - Раздел 3 (строки-сообщения): **5 — ✅ исправлено**.
- Подозрительных несоответствий: **4** (раздел 4).
- Грамматика (раздел 5): **✅ закрыто**. Реальных a/an-ошибок было **3** (п. 19, 21, 22) — исправлено (`a` → `an`); **5** (п. 20, 23, 24, 25, 26) — ❌ ложные записи (таких строк в коде нет). Дополнительный проход по всему `src/` других a/an-ошибок не выявил.
