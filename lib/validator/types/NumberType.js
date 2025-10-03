"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BasicType_1 = __importDefault(require("./BasicType"));
const ErrorManager_1 = __importDefault(require("../../errors/ErrorManager"));
class NumberType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'number';
    }
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex) {
        this.rule.example = ex;
        return this;
    }
    /**
     * Setting the default value
    */
    default(def) {
        this.rule.default = def;
        return this;
    }
    /**
     * Adds an integer check
    */
    integer() {
        this.rule.rules.push({ name: 'integer', args: {} });
        return this;
    }
    /**
     * Defines the maximum value for the rule
    */
    max(max) {
        this.rule.rules.push({ name: 'max', args: max });
        return this;
    }
    /**
     * Defines the minimal value for the rule
    */
    min(min) {
        this.rule.rules.push({ name: 'min', args: min });
        return this;
    }
    /**
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        this.basicValidate(obj, key);
        if (typeof obj[key] !== 'number')
            throw ErrorManager_1.default.make('VR_IS_NOT_NUMBER', { key });
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'integer':
                    this.checkInteger(obj, key);
                    break;
                case 'max':
                    this.checkMax(obj, key, subrule);
                    break;
                case 'min':
                    this.checkMin(obj, key, subrule);
                    break;
            }
        }
        return true;
    }
    /**
     *  Checking the maximum value
    */
    checkMax(obj, key, sub) {
        if (obj[key] > sub.args)
            throw ErrorManager_1.default.make('VR_NUMBER_MAX', { limit: sub.args });
    }
    /**
     *  Checking the minimal value
    */
    checkMin(obj, key, sub) {
        if (obj[key] < sub.args)
            throw ErrorManager_1.default.make('VR_NUMBER_MIN', { limit: sub.args });
    }
    /**
     * Integer check
    */
    checkInteger(obj, key) {
        if (!Number.isInteger(obj[key]))
            throw ErrorManager_1.default.make('VR_NUMBER_INTEGER', {});
    }
}
exports.default = NumberType;
ErrorManager_1.default.register('Validator', 'pn7B9po1UGRp', 'VR_IS_NOT_NUMBER', 'Value must be a number', {});
ErrorManager_1.default.register('Validator', 'fiUqanqqFlnt', 'VR_NUMBER_INTEGER', 'Value must be a integer', {});
ErrorManager_1.default.register('Validator', 'ZFSMAes0qdzC', 'VR_NUMBER_MAX', 'Number out of limit', {});
ErrorManager_1.default.register('Validator', 'B3zqsPub40HH', 'VR_NUMBER_MIN', 'Number out of limit', {});
