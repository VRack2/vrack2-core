"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
class ReactiveRef {
    /**
     * При создании иницируем объектом
    */
    constructor(initialValue) {
        /**
         * Колбэк для обработки при изменении значения
        */
        this.watcher = () => { };
        /**
         * Карта "прокси → исходный объект".
         * Позволяет строить снимок значения без прокси (см. `snapshot()`)
         */
        this._targets = new WeakMap();
        /**
         * Обратная карта "исходный объект → прокси"
         */
        this._rawToProxy = new WeakMap();
        this._value = this.makeReactive(initialValue);
    }
    /**
     * Глубокий снимок текущего значения без реактивных прокси:
     * plain-объекты и массивы клонируются, все остальные значения
     * (примитивы, Date, Map, экземпляры классов и т. д.) передаются как есть.
     * Циклические ссылки сохраняются.
     *
     * Нужен для передачи значения наружу: прокси нельзя сериализовать
     * (structured clone / postMessage бросают DataCloneError).
     *
     * @example
     * ```ts
     * const state = new ReactiveRef({ user: { name: 'Alice' } });
     * const snap = state.snapshot(); // { user: { name: 'Alice' } } — обычный объект
     * ```
     */
    snapshot() {
        return this.unwrap(this._value, new WeakMap());
    }
    /**
     * Рекурсивное "разматывание" прокси в обычные объекты/массивы
     */
    unwrap(value, seen) {
        if (value === null || typeof value !== 'object')
            return value;
        // Управляемое значение: прокси или "сырой" объект, для которого есть прокси
        const target = this._targets.get(value)
            ?? (this._rawToProxy.has(value) ? value : undefined);
        if (target !== undefined)
            return this.clonePlain(target, seen);
        if (Array.isArray(value)) {
            const cached = seen.get(value);
            if (cached !== undefined)
                return cached; // защита от цикла
            const out = [];
            seen.set(value, out);
            for (const item of value)
                out.push(this.unwrap(item, seen));
            return out;
        }
        // Вложенные plain-объекты (даже не управляемые) клонируем
        const proto = Object.getPrototypeOf(value);
        if (proto === Object.prototype || proto === null) {
            return this.clonePlain(value, seen);
        }
        // Остальные объекты (Date, Map, классы...) не трогаем
        return value;
    }
    /**
     * Клонирование plain-объекта по его исходному представлению
     */
    clonePlain(target, seen) {
        const cached = seen.get(target);
        if (cached !== undefined)
            return cached; // защита от цикла
        // Не-plain цели (Date, экземпляры классов) не разворачиваем в {}
        if (target instanceof Date)
            return new Date(target.getTime());
        const proto = Object.getPrototypeOf(target);
        if (proto !== Object.prototype && proto !== null)
            return target;
        const out = {};
        seen.set(target, out);
        for (const key of Object.keys(target)) {
            out[key] = this.unwrap(target[key], seen);
        }
        return out;
    }
    /**
     * Getter value
    */
    get value() {
        return this._value;
    }
    /**
     * Полная замена хранимого значения (новому значению тоже дается реактивность).
     * Уведомляет обработчик. Установка той же ссылки — без уведомления.
    */
    set(value) {
        if (this._value === value)
            return;
        this._value = this.isPlainObject(value) ? this.makeReactive(value) : value;
        this.watcher();
    }
    /**
     * Назначает обработчик который будет вызван при изменении объекта
    */
    watch(callback) {
        this.watcher = callback;
    }
    /**
     * Отключает обработчик (дальнейшие изменения значения уведомлять не будут)
    */
    unwatch() {
        this.watcher = () => { };
    }
    /**
     * Возвращает true если это простой объект не являющийся массивом или null
     * Null кстати тоже объект внутри JS из-за чего эта проверка очень актуальна
    */
    isPlainObject(val) {
        if (val === null || typeof val !== 'object' || Array.isArray(val))
            return false;
        const proto = Object.getPrototypeOf(val);
        return proto === Object.prototype || proto === null; // Date / Map / классы — не plain
    }
    /**
     * Делает переданный объект (если он объект) реактивным
     * Причем делает свойства объекта тоже реактивными рекурсивно
    */
    makeReactive(obj) {
        if (obj.__isReactive)
            return obj;
        // Отмечаем "сырой" объект ДО создания прокси, чтобы отметка
        // не прошла через set-trap (и не вызвала watcher).
        // Маркер неперечисляемый: Object.keys / spread / JSON.stringify его не видят
        Object.defineProperty(obj, '__isReactive', { value: true, enumerable: false, configurable: true });
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
            deleteProperty: (target, key) => {
                const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
                const result = Reflect.deleteProperty(target, key);
                // Уведомляем только если свойство реально существовало и было удалено
                if (hadOwn && result)
                    this.watcher();
                return result;
            },
        };
        const proxy = new Proxy(obj, handler);
        this._targets.set(proxy, obj);
        this._rawToProxy.set(obj, proxy);
        // Делаем уже существующие вложенные plain-объекты реактивными
        // (пишем прямо в "сырой" объект, минуя trap, чтобы не уведомлять)
        for (const key of Object.keys(obj)) {
            const child = obj[key];
            if (this.isPlainObject(child))
                obj[key] = this.makeReactive(child);
        }
        return proxy;
    }
}
exports.default = ReactiveRef;
