"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CoreError_1 = __importDefault(require("./CoreError"));
/**
 * A simple class for creating errors.
 * This centralized class is useful because you can find out the
 * list of all registered errors and which group/component they belong to.
 */
class ErrorManager {
    constructor() {
        /**
         * List of registered errors
        */
        this.registeredList = [];
    }
    /**
     * Error registration. An error must be registered before creating it
     *
     * @param name Property for error grouping
     * @param short Readable unique identifier (the canonical error ID)
     * @param description Error string (description)
    */
    register(name, short, description, rules = {}) {
        const reg = this.getRegistered(short);
        if (reg !== null) {
            // Если уже есть идентичная запись - просто игнорим
            if (reg.name === name && reg.short === short && reg.description === description && JSON.stringify(reg.rules) === JSON.stringify(rules)) {
                return;
            }
            else {
                throw this.make('EM_CODE_EXISTS', { short });
            }
        }
        const nr = { name, short, description, rules };
        this.registeredList.push(nr);
    }
    /**
     * Bulk error registration: registers every entry of the list at once.
     * `name` is the group (component) common for the whole list.
     * Atomic: if any entry conflicts with an already registered error
     * (or duplicates a short inside the list), nothing is registered
     * and EM_CODE_EXISTS is thrown.
     *
     * @param name Property for error grouping (component, common for the whole list)
     * @param list Array of { short, description, rules? }
    */
    registerMany(name, list) {
        // 1) Проверяем конфликтность: дубли short внутри списка + совпадение с уже зарегистрированными
        const seen = new Set();
        for (const entry of list) {
            if (seen.has(entry.short))
                throw this.make('EM_CODE_EXISTS', { short: entry.short });
            seen.add(entry.short);
            if (this.getRegistered(entry.short) !== null)
                throw this.make('EM_CODE_EXISTS', { short: entry.short });
        }
        // 2) Атомарно регистрируем (конфликтов нет — просто пушим)
        for (const entry of list) {
            const nr = { name, short: entry.short, description: entry.description, rules: entry.rules ?? {} };
            this.registeredList.push(nr);
        }
    }
    /**
     * Creating an instance of an error
     *
     * @param short
     * @param additional
    */
    make(short, additional = {}) {
        const reg = this.getRegistered(short);
        if (reg === null)
            throw this.make('EM_CODE_NOT_FOUND');
        const ne = new CoreError_1.default(reg.name, reg.description, reg.short);
        // Убираем из стека вызовы ErrorManager.make()
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(ne, this.make);
        }
        ne.vAdd = Object.keys(additional);
        return Object.assign(ne, additional);
    }
    /**
     * Converts a normal error to a VRack error
     *
     * @param error Ошибка для преобразования
    */
    convert(error) {
        if (error.vError)
            return error;
        const ne = this.make('EM_ERROR_CONVERT');
        ne.import(error);
        return ne;
    }
    /**
     * Проверяет является ли ошибка VRack2 Error
     * и соответствует ли код переданной ошибке (проверяет vShort)
    */
    isCode(error, code) {
        if (!this.isError(error))
            return false;
        if (error.vShort === code)
            return true;
        return false;
    }
    /**
     * Проверяет - принадлежит объект ошибки VRack2 Error
     *
     * Это не обязательно должен быть класс CoreError но и
     * любой сериализированный класс ошибки VRack2
    */
    isError(error) {
        if (error instanceof CoreError_1.default)
            return true;
        if (error.vError && error.vShort !== undefined)
            return true;
        return false;
    }
    /**
     * Searches for an error by code or short
     *
     * @param short Short error code or search error code
    */
    getRegistered(short) {
        for (const registered of this.registeredList)
            if (registered.short === short)
                return registered;
        return null;
    }
}
const GlobalErrorManager = new ErrorManager();
GlobalErrorManager.registerMany('ErrorManager', [
    { short: 'EM_CODE_EXISTS', description: 'Registering a different record with an already registered short identifier.' },
    { short: 'EM_CODE_NOT_FOUND', description: 'No such error found' },
    { short: 'EM_ERROR_CONVERT', description: 'Converted error' },
]);
exports.default = GlobalErrorManager;
