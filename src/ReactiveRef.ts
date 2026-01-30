/**
 * Простой реактивный ref-аналог (как в Vue 3), но только для объектов.
 * Поддерживает глубокую реактивность вложенных plain-объектов.
 * Массивы НЕ отслеживаются внутри — только при переприсвоении свойства целиком.
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
 * ```
 */
export default class ReactiveRef<T extends object> {
  /**
   * Хранимое значение
  */
  private _value: T;

  /**
   * Калбек для обработки при измении значения
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
   * Назначает обработчик который будет вызван при изменении объекта
  */
  watch(callback: () => void) {
    this.watcher = callback;
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
    };

    const proxy = new Proxy(obj, handler);
    (proxy as any).__isReactive = true;
    return proxy;
  }

}