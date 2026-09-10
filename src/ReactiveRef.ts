/**
 * Простой реактивный ref-аналог (как в Vue 3), но только для объектов.
 * Поддерживает глубокую реактивность вложенных plain-объектов.
 * Массивы НЕ отслеживаются внутри — только при переприсвоении свойства целиком.
 * Удаление существующего свойства (delete) уведомляет так же, как запись.
 * 
 * @example
 * ```ts
 * const state = new ReactiveRef({ user: { name: 'Alice' }, items: [1, 2] });
 * 
 * state.watch(() => console.log('изменилось!'));
 * 
 * state.value.user.name = 'Bob';        // вызовет callback
 * state.value.items = [1, 2, 3];        // вызовет callback
 * state.value.items.push(4);            // НЕ вызовет (мутация массива)
 * delete state.value.user.name;         // вызовет callback
 *
 * state.set({ user: { name: 'Eve' } }); // полная замена значения, вызовет callback
 * state.unwatch();                      // отключение обработчика
 * ```
 */
export default class ReactiveRef<T extends object> {
  /**
   * Хранимое значение
  */
  private _value: T;

  /**
   * Колбэк для обработки при изменении значения
  */
  private watcher: () => void = () => {};

  /**
   * При создании иницируем объектом
  */
  constructor(initialValue: T) {
    this._value = this.makeReactive(initialValue);
  }

  /**
   * Getter value
  */
  get value(): T {
    return this._value;
  }

  /**
   * Полная замена хранимого значения (новому значению тоже дается реактивность).
   * Уведомляет обработчик. Установка той же ссылки — без уведомления.
  */
  set(value: T) {
    if (this._value === value) return;
    this._value = this.isPlainObject(value) ? this.makeReactive(value) : value;
    this.watcher();
  }

  /**
   * Назначает обработчик который будет вызван при изменении объекта
  */
  watch(callback: () => void) {
    this.watcher = callback;
  }

  /**
   * Отключает обработчик (дальнейшие изменения значения уведомлять не будут)
  */
  unwatch() {
    this.watcher = () => {};
  }

  /**
   * Возвращает true если это простой объект не являющийся массивом или null
   * Null кстати тоже объект внутри JS из-за чего эта проверка очень актуальна
  */
  private isPlainObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  /**
   * Делает переданный объект (если он объект) реактивным 
   * Причем делает свойства объекта тоже реактивными рекурсивно
  */
  private makeReactive<TObj extends object>(obj: TObj): TObj {
    if ((obj as any).__isReactive) return obj;

    // Отмечаем "сырой" объект ДО создания прокси, чтобы отметка
    // не прошла через set-trap (и не вызвала watcher).
    // Маркер неперечисляемый: Object.keys / spread / JSON.stringify его не видят
    Object.defineProperty(obj, '__isReactive', { value: true, enumerable: false, configurable: true });

    const handler: ProxyHandler<TObj> = {
      set: (target, key, value) => {
        const oldValue = target[key as keyof TObj];
        const isOwn = Object.prototype.hasOwnProperty.call(target, key); 

        // Рекурсивно реактивизируем только обычные объекты (не массивы!)
        const nextValue = this.isPlainObject(value) ? this.makeReactive(value) : value;
        target[key as keyof TObj] = nextValue;
        // Уведомляем только при изменении значения
        if (!isOwn || oldValue !== nextValue) this.watcher();
        return true;
      },
      deleteProperty: (target, key) => {
        const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
        const result = Reflect.deleteProperty(target, key);
        // Уведомляем только если свойство реально существовало и было удалено
        if (hadOwn && result) this.watcher();
        return result;
      },
    };

    const proxy = new Proxy(obj, handler);

    // Делаем уже существующие вложенные plain-объекты реактивными
    // (пишем прямо в "сырой" объект, минуя trap, чтобы не уведомлять)
    for (const key of Object.keys(obj)) {
      const child = (obj as any)[key];
      if (this.isPlainObject(child)) (obj as any)[key] = this.makeReactive(child);
    }

    return proxy;
  }

}