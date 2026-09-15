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
ErrorManager_1.default.registerMany('Validator', [
    {
        short: 'VR_TYPE_NOT_EXISTS',
        description: 'Type not exists'
    },
    {
        short: 'VR_NOT_PASS',
        description: 'Validation error - data not pass'
    },
    {
        short: 'VR_VALIDATION_INTERNAL',
        description: 'An unexpected error occurred during validation'
    },
]);
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
     *    bool: Rule.boolean().required().default(true).description('Boolean checkbox')
     * }
     * ```
     *
     * After validating the object with the same properties
     *
     * ```
     * Validator.validate(rules, { bool: 'not a boolean value?'})
     * ```
     *
     *
     * **null / undefined semantics (fail-closed):**
     * - a missing key (undefined) is "absent": if a default() is set it is applied,
     *   otherwise a required() rule fails with VR_ERROR_REQUIRED and an
     *   optional rule passes (the type check of the field is skipped)
     * - a present value is always type-checked: an explicit null is rejected
     *   by the type checks (string, number, boolean, function, array, object;
     *   Rule.any() accepts it)
     * - NaN, Infinity and -Infinity are not valid numbers
     * - an unexpected exception inside a rule never lets the value pass:
     *   it is reported as a VR_VALIDATION_INTERNAL problem in VR_NOT_PASS
     *
     * @param rules List of rules like a associate object
     * @param data Data object for validate
    */
    static validate(rules, data) {
        if (rules === null || typeof rules !== 'object') {
            throw ErrorManager_1.default.make('VR_VALIDATION_INTERNAL', {
                original: 'rules must be an object of BasicType rules'
            });
        }
        const problems = [];
        for (const key of Object.keys(rules)) {
            const rule = rules[key];
            try {
                rule.validate(data, key);
            }
            catch (err) {
                if (err instanceof CoreError_1.default) {
                    problems.push(Validator.makeProblem(err, key, Validator.exportRule(rule), Validator.readValue(data, key)));
                }
                else {
                    // Fail-closed: an unexpected exception (a broken rule, a
                    // TypeError, ...) must never let the value pass silently
                    problems.push(Validator.makeProblem(Validator.makeInternalError(key, err), key, Validator.exportRule(rule), Validator.readValue(data, key)));
                }
            }
        }
        if (problems.length)
            Validator.makeError(problems);
        return true;
    }
    /**
     * Wraps an unexpected (non-CoreError) exception into a VRack error
     *
     * The original exception message is preserved in the original argument
     * so the problem report stays informative and JSON-safe
     *
     * @param key key for getting value from object
     * @param err Unexpected exception
    */
    static makeInternalError(key, err) {
        const original = (err instanceof Error) ? (err.name + ': ' + err.message) : String(err);
        return ErrorManager_1.default.make('VR_VALIDATION_INTERNAL', { key, original });
    }
    /**
     * Safely exports a rule for the problem report
     *
     * A malformed rules table (a plain object or undefined instead of a
     * BasicType) must not break the error report itself
     *
     * @param rule Checked rule
    */
    static exportRule(rule) {
        if (rule !== null && rule !== undefined && typeof rule.export === 'function')
            return rule.export();
        return { type: '', require: false, default: undefined, rules: [], example: undefined, description: '', message: '' };
    }
    /**
     * Safely reads the validated value for the problem report
     *
     * The data object may be null or undefined (a malformed input) and
     * the report itself must not throw
     *
     * @param data Data object for validate
     * @param key key for getting value from object
    */
    static readValue(data, key) {
        if (data === null || data === undefined)
            return undefined;
        try {
            return data[key];
        }
        catch (e) {
            return undefined;
        }
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
            type: err.vShort, fieldKey: key, description: err.message, rule, arg: {}
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
     *  Rule.number().description('My number').message('{description} must be 1,2,3,4,5,6... not {value}')
     * ```
     *
     * Single-pass replacement: every {value} {example} {default}
     * {description} occurrence is substituted, the substituted text is
     * never re-scanned and values are inserted as-is (no $& / $$ artifacts)
    */
    static makeMessage(rule, value) {
        const message = (typeof rule.message === 'string') ? rule.message : '';
        const val = String(Validator.toInspect(value));
        const example = String(Validator.toInspect(rule.example));
        const def = String(Validator.toInspect(rule.default));
        const description = String(rule.description);
        // Single pass: every placeholder occurrence is substituted at once,
        // the substituted text is never re-scanned and the value is inserted
        // as-is (a function replacement avoids $&, $$ and other
        // String.replace artifacts)
        return message.replace(/\{(?:value|example|default|description)\}/g, (ph) => {
            switch (ph) {
                case '{value}': return val;
                case '{example}': return example;
                case '{default}': return def;
                case '{description}': return description;
            }
            return ph;
        });
    }
    static toInspect(value) {
        if (typeof value === "object" || typeof value === "function") {
            return util_1.default.inspect(value, { showHidden: false, depth: null, compact: false });
        }
        return value;
    }
}
exports.default = Validator;
