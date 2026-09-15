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
class NumberType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'number';
        this.checkers.set(IValidationSubrule_1.SubruleNames.integer, (obj, key) => this.checkInteger(obj, key));
        this.checkers.set(IValidationSubrule_1.SubruleNames.max, (obj, key, sub) => this.checkMax(obj, key, sub));
        this.checkers.set(IValidationSubrule_1.SubruleNames.min, (obj, key, sub) => this.checkMin(obj, key, sub));
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
     * Adds an integer check
    */
    integer() {
        this.addSubrule(IValidationSubrule_1.SubruleNames.integer, {});
        return this;
    }
    /**
     * Defines the maximum value for the rule
    */
    max(max) {
        this.addSubrule(IValidationSubrule_1.SubruleNames.max, max);
        return this;
    }
    /**
     * Defines the minimal value for the rule
    */
    min(min) {
        this.addSubrule(IValidationSubrule_1.SubruleNames.min, min);
        return this;
    }
    /**
     * Method of validation of this type
     *
     * Accepts only finite numbers: NaN, Infinity and -Infinity are
     * rejected with VR_IS_NOT_NUMBER
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        if (!this.basicValidate(obj, key))
            return true;
        if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key]))
            throw ErrorManager_1.default.make('VR_IS_NOT_NUMBER', { key });
        this.checkSubrules(obj, key);
        return true;
    }
    /**
     *  Checking the maximum value
    */
    checkMax(obj, key, sub) {
        if (obj[key] > sub.args)
            throw ErrorManager_1.default.make('VR_NUMBER_MAX', { limit: sub.args, key });
    }
    /**
     *  Checking the minimal value
    */
    checkMin(obj, key, sub) {
        if (obj[key] < sub.args)
            throw ErrorManager_1.default.make('VR_NUMBER_MIN', { limit: sub.args, key });
    }
    /**
     * Integer check
    */
    checkInteger(obj, key) {
        if (!Number.isInteger(obj[key]))
            throw ErrorManager_1.default.make('VR_NUMBER_INTEGER', { key });
    }
}
exports.default = NumberType;
ErrorManager_1.default.register('Validator', 'VR_IS_NOT_NUMBER', 'Value must be a number', {});
ErrorManager_1.default.register('Validator', 'VR_NUMBER_INTEGER', 'Value must be an integer', {});
ErrorManager_1.default.register('Validator', 'VR_NUMBER_MAX', 'Number out of limit', {});
ErrorManager_1.default.register('Validator', 'VR_NUMBER_MIN', 'Number out of limit', {});
