"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ErrorManager_1 = __importDefault(require("../../errors/ErrorManager"));
class BasicType {
    constructor() {
        this.rule = {
            type: '',
            require: false,
            default: undefined,
            rules: [],
            example: undefined,
            description: '',
            message: '',
        };
    }
    require() {
        this.rule.require = true;
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
     * Description of the validated object property
     *
     * @param desc
    */
    description(desc) {
        this.rule.description = desc;
        return this;
    }
    /**
      * Make message use message template
      *
      * If you want to change the default message, you can use a template in the message parameter
      *
      * @example
      * ```js
      *  Rule.number().description('My number').message('{description} must by 1,2,3,4,5,6... not {value}')
      * ```
      * Use {description} {value} {default} {example} in template
     */
    message(mess) {
        this.rule.message = mess;
        return this;
    }
    /**
     * Exporting a rule for use
     * Typically used within VRack or VRack-Core
     *
     * !!! hide for external users !!!
     * @private
    */
    export() {
        return JSON.parse(JSON.stringify(this.rule));
    }
    /**
     * This method will be executed when converting a Rule object to JSON
    */
    toJSON() {
        return this.rule;
    }
    /**
     * Performs general validation rules
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    basicValidate(obj, key) {
        this.checkDefault(obj, key);
        this.checkRequire(obj, key);
        return true;
    }
    /**
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        return true;
    }
    /**
     * Sets the default value if it has not been set
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    checkDefault(obj, key) {
        if (this.rule.default === undefined)
            return;
        if (obj[key] === undefined)
            obj[key] = this.rule.default;
    }
    /**
     * Checks if the initialized property of an object
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    checkRequire(obj, key) {
        if (obj[key] === undefined)
            throw ErrorManager_1.default.make('VR_ERROR_REQUAERED', { key });
    }
}
exports.default = BasicType;
ErrorManager_1.default.register('Validator', 'Jwg5Mr1NqaSj', 'VR_ERROR_REQUAERED', 'A value is required', {});
