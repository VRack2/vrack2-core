"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = __importDefault(require("util"));
const ErrorManager_1 = __importDefault(require("../errors/ErrorManager"));
const CoreError_1 = __importDefault(require("../errors/CoreError"));
ErrorManager_1.default.register('Validator', 'VXLeMLVnIXGf', 'VR_TYPE_NOT_EXISTS', 'Type not exists', {});
ErrorManager_1.default.register('Validator', 'X1UP4P2HRHWd', 'VR_NOT_PASS', 'Validation error - data not pass', {});
class Validator {
    /**
     * Validation of the object by rule.
     * You cannot validate a specific value.
     * You can only validate an object property.
     *
     * For validation you need to create an object with rules
     *
     * ```ts
     * const rules = {
     *    bool: Rule.boolean().require().default(true).description('Boolean checkbox')
     * }
     * ```
     *
     * After validating the object with the same properties
     *
     * ```
     * Validator.validate(rules, { bool: 'not a boolean value?'})
     * ```
     *
     * @param rules List of rules like a associate object
     * @param data Data object for validate
    */
    static validate(rules, data) {
        const problems = [];
        for (const key of Object.keys(rules)) {
            const rule = rules[key];
            try {
                rule.validate(data, key);
            }
            catch (err) {
                if (err instanceof CoreError_1.default)
                    problems.push(Validator.makeProblem(err, key, rule.export(), data[key]));
            }
        }
        if (problems.length)
            Validator.makeError(problems);
        return true;
    }
    /**
     * Creates a top-level error for validation problems
     *
     * @param eList List of validation errors
    */
    static makeError(eList) {
        throw ErrorManager_1.default.make('VR_NOT_PASS', {
            problems: eList
        });
    }
    /**
     * Create validation problem
     *
     * @param err Validation exception
     * @param key key for getting value from object
     * @param rule Checked rule
    */
    static makeProblem(err, key, rule, value) {
        if (rule.message)
            err.message = this.makeMessage(rule, value);
        const nvp = {
            type: err.vShort, code: err.vCode, fieldKey: key, description: err.message, rule, arg: {}
        };
        for (const sk of err.vAdd)
            nvp.arg[sk] = err[sk];
        return nvp;
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
    */
    static makeMessage(rule, value) {
        let message = rule.message;
        const val = Validator.toInspect(value);
        const example = Validator.toInspect(rule.example);
        const def = Validator.toInspect(rule.default);
        message.replace('{value}', val);
        message.replace('{example}', example);
        message.replace('{default}', def);
        message.replace('{description}', rule.description);
        return message;
    }
    static toInspect(value) {
        if (typeof value === "object" || typeof value === "function") {
            return util_1.default.inspect(value, { showHidden: false, depth: null, compact: false });
        }
        return value;
    }
}
exports.default = Validator;
