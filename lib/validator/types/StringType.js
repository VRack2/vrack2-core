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
class StringType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'string';
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
     * Sets the maximum length of the string
    */
    maxLength(max) {
        this.rule.rules.push({ name: 'maxLength', args: max });
        return this;
    }
    /**
     * Sets the minimum length of the string
    */
    minLength(min) {
        this.rule.rules.push({ name: 'minLength', args: min });
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
        if (typeof obj[key] !== 'string')
            throw ErrorManager_1.default.make('VR_IS_NOT_STRING', { key });
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'maxLength':
                    this.checkMaxLength(obj, key, subrule);
                    break;
                case 'minLength':
                    this.checkMinLength(obj, key, subrule);
                    break;
            }
        }
        return true;
    }
    /**
     * Checking the maximum string length
    */
    checkMaxLength(obj, key, sub) {
        const val = obj[key];
        if (val.length >= sub.args)
            throw ErrorManager_1.default.make('VR_STRING_MAX_LENGTH', { limit: sub.args, key });
    }
    /**
     * Checking the minimum string length
    */
    checkMinLength(obj, key, sub) {
        const val = obj[key];
        if (val.length <= sub.args)
            throw ErrorManager_1.default.make('VR_STRING_MIN_LENGTH', { limit: sub.args, key });
    }
}
exports.default = StringType;
ErrorManager_1.default.register('Validator', 'klmjxHyQrWuH', 'VR_IS_NOT_STRING', 'Value must be a string', {});
ErrorManager_1.default.register('Validator', 'BL5lxR4BinkA', 'VR_STRING_MAX_LENGTH', 'The maximum string length is limited', {});
ErrorManager_1.default.register('Validator', 'KsijTdsbd2YN', 'VR_STRING_MIN_LENGTH', 'The minimum string length is limited', {});
