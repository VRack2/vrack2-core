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
 * This centralized class is useful because you can find out t
 * he list of all registered errors and which group/component they belong to.
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
     * @param code Unique random string code ID
     * @param short Readable unique identifier
     * @param description Error string (description)
    */
    register(name, code, short, description, rules = {}) {
        const reg1 = this.getRegistered(code);
        const reg2 = this.getRegistered(short);
        if (reg1 !== null || reg2 !== null) {
            // Если уже есть идентичная запись - просто игнорим
            if ((reg1 === null || reg1 === void 0 ? void 0 : reg1.code) === (reg2 === null || reg2 === void 0 ? void 0 : reg2.code) && (reg1 === null || reg1 === void 0 ? void 0 : reg1.short) === (reg2 === null || reg2 === void 0 ? void 0 : reg2.short)) {
                return;
            }
            else {
                throw this.make('EM_CODE_EXISTS', { code, short });
            }
        }
        const nr = { name, code, short, description, rules };
        this.registeredList.push(nr);
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
        const ne = new CoreError_1.default(reg.name, reg.description, reg.code, reg.short);
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
     * и соответсвует ли код переданной ошибке (проверяет vShort и vCode)
    */
    isCode(error, code) {
        if (!this.isError(error))
            return false;
        if (error.vShort === code || error.vCode === code)
            return true;
        return false;
    }
    /**
     * Проверяет - пренадлежит объект ошибки VRack2 Error
     *
     * Это не обязательно должен быть класс CoreError но и
     * любой сериализированный класс ошибки VRack2
    */
    isError(error) {
        if (error instanceof CoreError_1.default)
            return true;
        if (error.vError && error.vCode !== undefined && error.vShort !== undefined)
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
            if (registered.code === short || registered.short === short)
                return registered;
        return null;
    }
}
const GlobalErrorManager = new ErrorManager();
GlobalErrorManager.register('ErrorManager', 'NcZIb9QvQRcq', 'EM_CODE_EXISTS', 'Has anyone else encountered this error code? Possible duplication of the error code and short word in different registrations.');
GlobalErrorManager.register('ErrorManager', 'uLYv4mE1Yo50', 'EM_CODE_NOT_FOUND', 'No such error found');
GlobalErrorManager.register('ErrorManager', 'RIl3BUrxWOzP', 'EM_ERROR_CONVERT', 'Converted error');
exports.default = GlobalErrorManager;
