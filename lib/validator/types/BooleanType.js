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
class BooleanType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'boolean';
    }
    /**
     * Setting the default value
    */
    default(def) {
        this.rule.default = def;
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
        if (typeof obj[key] !== 'boolean')
            throw ErrorManager_1.default.make('VR_IS_NOT_BOOLEAN', { key });
        return true;
    }
}
exports.default = BooleanType;
ErrorManager_1.default.register('Validator', 'Fr7BvAlZyZPm', 'VR_IS_NOT_BOOLEAN', 'Value must be a number', {});
