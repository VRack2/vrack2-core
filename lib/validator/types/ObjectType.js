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
const IValidationSubrule_1 = require("../IValidationSubrule");
class ObjectType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'object';
        this.checkers.set(IValidationSubrule_1.SubruleNames.fields, (obj, key, sub) => this.subValidate(obj, key, sub));
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
     * Setting the default value
    */
    default(def) {
        this.invalidateExport();
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
     *       bool: Rule.boolean().required().default(true).description('Boolean checkbox')
     *  }).description('Test object description'),
     * ```
    */
    fields(obj) {
        this.addSubrule(IValidationSubrule_1.SubruleNames.fields, obj);
        return this;
    }
    /**
     * Method of validation of this type
     *
     * An explicit null is rejected: typeof null is object but null
     * is not a valid object value
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        if (!this.basicValidate(obj, key))
            return true;
        if (obj[key] === null || typeof obj[key] !== 'object')
            throw ErrorManager_1.default.make('VR_IS_NOT_OBJECT', { key });
        this.checkSubrules(obj, key);
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
            // Fail-closed: any exception inside the fields fails the object
            const e = (error instanceof Error) ? error : new Error(String(error));
            throw ErrorManager_1.default.make('VR_ERROR_OBJECT_FIELDS', { key }).add(e);
        }
    }
}
exports.default = ObjectType;
ErrorManager_1.default.register('Validator', 'zOPzOab9oLum', 'VR_IS_NOT_OBJECT', 'Value must be an object', {});
ErrorManager_1.default.register('Validator', 'p7qSfRGixV0M', 'VR_ERROR_OBJECT_FIELDS', 'Error of validation of fields inside the object', {});
