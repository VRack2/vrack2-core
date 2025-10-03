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
class ObjectType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'object';
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
     * Rule object for defining properties
     *
     * Allows you to describe the fields of the required object
     *
     * @example
     * ```ts
     *  obj: Rule.object().fields({
     *       bool: Rule.boolean().require().default(true).description('Boolean checkbox')
     *  }).description('TEst ibject description'),
     * ```
    */
    fields(obj) {
        this.rule.rules.push({ name: 'fields', args: obj });
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
        if (typeof obj[key] !== 'object')
            throw ErrorManager_1.default.make('VR_IS_NOT_OBJECT', {});
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'fields':
                    this.subValidate(obj, key, subrule);
                    break;
            }
        }
        return true;
    }
    /**
     * Validate object fields
    */
    subValidate(obj, key, sub) {
        try {
            Validator_1.default.validate(sub.args, obj[key]);
        }
        catch (error) {
            if (error instanceof Error) {
                throw ErrorManager_1.default.make('VR_ERROR_OBJECT_FIELDS', { key }).add(error);
            }
        }
    }
}
exports.default = ObjectType;
ErrorManager_1.default.register('Validator', 'zOPzOab9oLum', 'VR_IS_NOT_OBJECT', 'Value must be a object', {});
ErrorManager_1.default.register('Validator', 'p7qSfRGixV0M', 'VR_ERROR_OBJECT_FIELDS', 'Error of validation of fields inside the object', {});
