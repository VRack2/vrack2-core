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
        if (reg1 !== null || reg2 !== null)
            throw this.make('EM_CODE_EXISTS', { code, short });
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
GlobalErrorManager.register('ErrorManager', 'NcZIb9QvQRcq', 'EM_CODE_EXISTS', 'This code already exists');
GlobalErrorManager.register('ErrorManager', 'uLYv4mE1Yo50', 'EM_CODE_NOT_FOUND', 'No such error found');
GlobalErrorManager.register('ErrorManager', 'RIl3BUrxWOzP', 'EM_ERROR_CONVERT', 'Converted error');
exports.default = GlobalErrorManager;
