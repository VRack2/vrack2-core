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
const IValidationSubrule_1 = require("../IValidationSubrule");
const Validator_1 = __importDefault(require("../Validator"));
class ArrayType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'array';
        this.checkers.set(IValidationSubrule_1.SubruleNames.contain, (obj, key, sub) => this.checkContent(obj, key, sub));
    }
    /**
     * Setting the default value
    */
    default(def) {
        this.invalidateExport();
        this.rule.default = def;
        return this;
    }
    /**
     * Sets the rule to be applied to each element of the array
     *
     * @example
     *
     * ```
     * Rule.array().required().content(
     *    Rule.string().default('').maxLength(24).description('Element of list')
     * )
     * ```
     *
    */
    content(t) {
        this.addSubrule(IValidationSubrule_1.SubruleNames.contain, t);
        return this;
    }
    /**
     * Example of a valid value for this rule
     *
     * @param ex Example valid value
    */
    example(ex) {
        this.invalidateExport();
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
        if (!this.basicValidate(obj, key))
            return true;
        if (!Array.isArray(obj[key]))
            throw ErrorManager_1.default.make('VR_IS_NOT_ARRAY', { key });
        this.checkSubrules(obj, key);
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
        const items = obj[key];
        for (let index = 0; index < items.length; index++) {
            sw.value = items[index];
            try {
                Validator_1.default.validate(tr, sw);
            }
            catch (error) {
                // Fail-closed: any exception on an element fails the array
                const e = (error instanceof Error) ? error : new Error(String(error));
                throw ErrorManager_1.default.make('VR_ARRAY_CONTENT_ERROR', { key, index }).add(e);
            }
        }
    }
}
exports.default = ArrayType;
ErrorManager_1.default.register('Validator', '3U9s3ZsTH6FA', 'VR_IS_NOT_ARRAY', 'Value must be an array', {});
ErrorManager_1.default.register('Validator', 'Eg9cIXlxi1yP', 'VR_ARRAY_CONTENT_ERROR', 'Validation error inside the array data', {});
