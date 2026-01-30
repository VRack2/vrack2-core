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
    private _value;
    /**
     * Калбек для обработки при измении значения
    */
    private watcher;
    /**
     * При создании иницируем объектом
    */
    constructor(initialValue: T);
    /**
     * Getter value
    */
    get value(): T;
    /**
     * Назначает обработчик который будет вызван при изменении объекта
    */
    watch(callback: () => void): void;
    /**
     * Возвращает true если это простой объект не являющийся массивом или null
     * Null кстати тоже объект внутри JS из-за чего эта проверка очень актуальна
    */
    private isPlainObject;
    /**
     * Делает переданный объект (если он объект) реактивным
     * Причем делает свойства объекта тоже реактивными рекурсивно
    */
    private makeReactive;
}
