"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
class ReactiveRef {
    /**
     * При создании иницируем объектом
    */
    constructor(initialValue) {
        /**
         * Калбек для обработки при измении значения
        */
        this.watcher = () => { };
        this._value = this.makeReactive(initialValue);
    }
    /**
     * Getter value
    */
    get value() {
        return this._value;
    }
    /**
     * Назначает обработчик который будет вызван при изменении объекта
    */
    watch(callback) {
        this.watcher = callback;
    }
    /**
     * Возвращает true если это простой объект не являющийся массивом или null
     * Null кстати тоже объект внутри JS из-за чего эта проверка очень актуальна
    */
    isPlainObject(val) {
        return val !== null && typeof val === 'object' && !Array.isArray(val);
    }
    /**
     * Делает переданный объект (если он объект) реактивным
     * Причем делает свойства объекта тоже реактивными рекурсивно
    */
    makeReactive(obj) {
        if (obj.__isReactive)
            return obj;
        const handler = {
            set: (target, key, value) => {
                const oldValue = target[key];
                const isOwn = Object.prototype.hasOwnProperty.call(target, key);
                // Рекурсивно реактивизируем только обычные объекты (не массивы!)
                const nextValue = this.isPlainObject(value) ? this.makeReactive(value) : value;
                target[key] = nextValue;
                // Уведомляем только при изменении значения
                if (!isOwn || oldValue !== nextValue)
                    this.watcher();
                return true;
            },
        };
        const proxy = new Proxy(obj, handler);
        proxy.__isReactive = true;
        return proxy;
    }
}
exports.default = ReactiveRef;
