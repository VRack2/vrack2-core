export default class Utility {
    /**
     * Check device name (device ID)
     * */
    static isDeviceName(name: string): Promise<boolean>;
    /**
     * Форматирует любое значение в красивую строку (с отступами, подсветкой и т. д.).
     * Поддерживает: объекты, массивы, примитивы, Error, Map, Set, Buffer и др.
     *
     * @param {any} value - Значение для форматирования
     * @param {object} [options] - Дополнительные опции (как в `util.inspect()`)
     * @returns {string} Отформатированная строка
     */
    static prettyFormat(value: any, options?: {}): string | undefined;
}
