/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import util from "util"

export default class Utility {
    /** 
     * Check device name (device ID)
     * */
    static async isDeviceName(name: string) {
        return /^[a-zA-Z0-9_*-:]+$/.test(name)
    }

    /**
     * Форматирует любое значение в красивую строку (с отступами, подсветкой и т. д.).
     * Поддерживает: объекты, массивы, примитивы, Error, Map, Set, Buffer и др.
     * 
     * @param {any} value - Значение для форматирования
     * @param {object} [options] - Дополнительные опции (как в `util.inspect()`)
     * @returns {string} Отформатированная строка
     */
    static prettyFormat(value: any, options = {}) {
        const defaultOptions = {
            depth: null,      // Показывать всю вложенность
            colors: true,     // Цвета в терминале
            compact: false,   // Не сжимать в одну строку
            breakLength: 80,  // Длина строки перед переносом
            sorted: false,    // Сортировка ключей (если true)
            showHidden: false, // Показывать скрытые свойства (для объектов)
            ...options        // Переопределение дефолтных опций
        };

        // Особые случаи (если нужно обработать их по-особому)
        if (value instanceof Error) {
            return value.stack; // Стек ошибки
        }

        // Всё остальное форматируем через util.inspect()
        return util.inspect(value, defaultOptions);
    }
}