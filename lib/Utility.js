"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
class Utility {
    /**
     * Check device name (device ID)
     * */
    static async isDeviceName(name) {
        return /^[a-zA-Z0-9_*-:]+$/.test(name);
    }
    /**
     * Форматирует любое значение в красивую строку (с отступами, подсветкой и т. д.).
     * Поддерживает: объекты, массивы, примитивы, Error, Map, Set, Buffer и др.
     *
     * @param {any} value - Значение для форматирования
     * @param {object} [options] - Дополнительные опции (как в `util.inspect()`)
     * @returns {string} Отформатированная строка
     */
    static prettyFormat(value, options = {}) {
        const defaultOptions = {
            depth: null,
            colors: true,
            compact: false,
            breakLength: 80,
            sorted: false,
            showHidden: false,
            ...options // Переопределение дефолтных опций
        };
        // Особые случаи (если нужно обработать их по-особому)
        if (value instanceof Error) {
            return value.stack; // Стек ошибки
        }
        // Всё остальное форматируем через util.inspect()
        return util_1.default.inspect(value, defaultOptions);
    }
}
exports.default = Utility;
