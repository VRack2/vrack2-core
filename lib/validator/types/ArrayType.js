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
const Validator_1 = __importDefault(require("../Validator"));
const CoreError_1 = __importDefault(require("../../errors/CoreError"));
class ArrayType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'array';
    }
    /**
     * Setting the default value
    */
    default(def) {
        this.rule.default = def;
        return this;
    }
    /**
     * Sets the rule to be applied to each element of the array
     *
     * @example
     *
     * ```
     * Rule.array().require().content(
     *    Rule.string().default('').maxLength(24).description('Element of list')
     * )
     * ```
     *
    */
    content(t) {
        this.rule.rules.push({ name: 'contain', args: t });
        return this;
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
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        this.basicValidate(obj, key);
        if (!Array.isArray(obj[key]))
            throw ErrorManager_1.default.make('VR_IS_NOT_ARRAY', {});
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'fields':
                    this.checkContent(obj, key, subrule);
            }
        }
        return true;
    }
    /**
     * Checks the rules for content inside the array
     *
     * @param obj Validation object
     * @param key Key for getting value from object
     * @param sub Sub rule for check array content
    */
    checkContent(obj, key, sub) {
        const sw = { value: undefined };
        const tr = { value: sub.args };
        for (const index of obj[key]) {
            sw.value = obj[key][index];
            try {
                Validator_1.default.validate(tr, sw);
            }
            catch (error) {
                if (error instanceof CoreError_1.default) {
                    throw ErrorManager_1.default.make('VR_ARRAY_CONTENT_ERROR', { index }).add(error);
                }
            }
        }
    }
}
exports.default = ArrayType;
ErrorManager_1.default.register('Validator', '3U9s3ZsTH6FA', 'VR_IS_NOT_ARRAY', 'Value must be a array', {});
ErrorManager_1.default.register('Validator', 'Eg9cIXlxi1yP', 'VR_ARRAY_CONTENT_ERROR', 'Validation error inside the array data', {});
