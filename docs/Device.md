# Документация для класса `Device`

## Общее описание
Класс `Device` представляет базовый класс для всех устройств в системе. Это абстрактный класс, который определяет:
- Основные свойства и методы всех устройств
- Механизмы взаимодействия с контейнером
- Систему портов для связи между устройствами
- Обработку действий и метрик
- Систему событий и сообщений

Устройства наследуются от этого класса и реализуют свою специфическую логику.

## Основные свойства

Основные свойства устройства назнаются контейнером при инициализации устройства согласно файлу сервиса.

  - **id** *string* - Уникальный идентификатор устройства в рамках контейнера. Обычно начинается с заглавной буквы. 
  - **type** *string* - Тип устройства в формате "вендор.Устройство".
  - **Container** *Container* - Ссылка на контейнер, который создал устройство
  - **options** *any* - Параметры устройства

## Переопределяемые методы и свойства

#### preProcess()
Вызывается на этапе инициализации устройства (до создания соединений). Тут еще есть возможность поменять количество портов, создать обработчики для входящих портов, или например обработчики для экшенов. На этом этапе только создается класс и назначаются основные свойства.

#### process()
Основной метод запуска устройства (после инициализации всех соединений).

#### processPromise()
Асинхронная версия process() - контейнер ждет завершения всех processPromise().


### ports
Объект для управления портами устройства:
```typescript
ports: {
  input: { [key: string]: DevicePort }  // Входные порты
  output: { [key: string]: DevicePort } // Выходные порты
}
```

### Container
Ссылка на контейнер, в котором находится устройство.
```typescript
Container: Container;
```

### options
Параметры устройства, которые проверяются методом `checkOptions()`.
```typescript
options: { [key: string]: any } = {};
```

### shares
Быстро обновляемые данные устройства, которые отправляются подписчикам после вызова `render()`.
```typescript
shares: any = {};
```

### storage
Данные устройства, которые сохраняются между сеансами работы.
```typescript
storage: any = {}
```

## Основные методы

### Конструктор
```typescript
constructor(id: string, type: string, Container: Container)
```
- `id` - уникальный ID устройства
- `type` - тип устройства
- `Container` - ссылка на контейнер

### settings()
Возвращает настройки устройства, включая список каналов связи.
```typescript
settings(): IDeviceSettings {
  return {
    channels: ['terminal', 'notify', 'event', 'action', 'alert', 'error', 'render']
  }
}
```

### description()
Возвращает описание устройства (может содержать markdown).
```typescript
description(): string {
  return ''
}
```

### actions()
Определяет список действий, которые можно выполнять с устройством.
```typescript
actions(): { [key: string]: BasicAction } { return {} }
// Пример:
// return {
//   'test.action': Action.global().requirements({
//     id: Rule.string().require().default('www').description('Some id')
//   }).description('Test action')
// }
```

### metrics()
Определяет метрики устройства.
```typescript
metrics(): { [key: string]: BasicMetric } { return {} }
// Пример:
// return {
//   'temperature': Metric.inS().retentions('1s:6h').description('Temperature metric')
// }
```

### checkOptions()
Определяет правила валидации параметров устройства.
```typescript
checkOptions(): { [key: string]: BasicType } { return {} }
// Пример:
// return {
//   timeout: Rule.number().integer().min(0).description('Interval timeout').example(0)
// }
```

### inputs() / outputs()
Определяют входные и выходные порты устройства.
```typescript
inputs(): { [key: string]: BasicPort } { return {} }
outputs(): { [key: string]: BasicPort } { return {} }
// Пример:
// return {
//   'sensor.temperature': Port.standart(),
//   'control.setpoint': Port.standart()
// }
```

### Жизненный цикл устройства

#### preProcess()
Вызывается на этапе инициализации устройства (до создания соединений).

#### process()
Основной метод запуска устройства (после инициализации всех соединений).

#### processPromise()
Асинхронная версия process() - контейнер ждет завершения всех processPromise().

### Методы работы с данными

#### render()
Отправляет данные из `shares` подписчикам.

#### save()
Сохраняет данные из `storage`.

#### metric()
Записывает значение метрики.
```typescript
metric(path: string, value: number, modify: 'last' | 'first' | 'max' | 'min' | 'avg' | 'sum' = 'last')
```

### Методы сообщений

#### terminal() / notify() / event() / alert() / error()
Отправляют сообщения разных типов.
```typescript
terminal(data: string, trace: { [key: string]: any }, ...args: any[])
notify(data: string, trace: { [key: string]: any }, ...args: any[])
// и т.д.
```

### Вспомогательные методы

#### addInputHandler()
Добавляет обработчик для входного порта.
```typescript
addInputHandler(name: string, action: (data: any) => any)
// Пример:
// this.addInputHandler('control.setpoint', (value) => { ... })
```

#### addActionHandler()
Добавляет обработчик для действия.
```typescript
addActionHandler(name: string, action: (data: any) => any)
// Пример:
// this.addActionHandler('set.temperature', (data) => { ... })
```

#### terminate()
Сигнализирует о критической ошибке и необходимости остановки устройства.
```typescript
terminate(error: Error, action: string)
```

## Интерфейсы

### IDeviceSettings
Настройки устройства:
```typescript
interface IDeviceSettings {
  channels: Array<'terminal' | 'notify' | 'event' | 'action' | 'alert' | 'error' | 'render'>;
}
```

### IDeviceEvent
Структура события устройства:
```typescript
interface IDeviceEvent {
  device: string;       // ID устройства
  data: string;         // Данные события
  trace: { [key: string]: any }; // Дополнительная информация
}
```

## Пример использования
```typescript
class TemperatureSensor extends Device {
  private currentTemp = 0;

  description(): string {
    return 'Датчик температуры с возможностью установки уставки';
  }

  actions() {
    return {
      'set.temperature': Action.global()
        .requirements({
          value: Rule.number().min(-50).max(100).description('Температура')
        })
        .description('Установка температуры')
    };
  }

  metrics() {
    return {
      'temperature': Metric.inS().retentions('1s:6h').description('Текущая температура')
    };
  }

  inputs() {
    return {
      'control.setpoint': Port.standart()
    };
  }

  process() {
    // Чтение температуры каждую секунду
    setInterval(() => {
      this.currentTemp = readTemperature();
      this.metric('temperature', this.currentTemp);
      this.render();
    }, 1000);
  }

  // Обработчик действия
  actionSetTemperature(data: { value: number }) {
    this.currentTemp = data.value;
    return { status: 'ok' };
  }
}
```

Класс `Device` предоставляет мощную основу для создания различных устройств с поддержкой:
- Валидации параметров
- Действий с внешним интерфейсом
- Метрик для мониторинга
- Портов для связи между устройствами
- Различных типов сообщений
- Жизненного цикла устройства