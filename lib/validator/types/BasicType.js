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
        this.checkers = new Map();
    }
    /**
     * Marks the field as required.
     *
     * A missing value (undefined) fails with VR_ERROR_REQUIRED.
     * Without this flag the field is optional: a missing value passes and
     * skips the type check of the rule. A present value is always
     * type-checked (an explicit null is present and is rejected)
     */
    required() {
        this.invalidateExport();
        this.rule.require = true;
        return this;
    }
    /**
     * Вскоре будет удален
     * @see required
     * @deprecated use required()
    */
    require() {
        this.invalidateExport();
        this.rule.require = true;
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
     * Description of the validated object property
     *
     * @param desc
    */
    description(desc) {
        this.invalidateExport();
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
      *  Rule.number().description('My number').message('{description} must be 1,2,3,4,5,6... not {value}')
      * ```
      * Use {description} {value} {default} {example} in template
     */
    message(mess) {
        this.invalidateExport();
        this.rule.message = mess;
        return this;
    }
    /**
     * Exporting a rule for use
     * Typically used within VRack or VRack-Core
     *
     * Returns a snapshot of the rule state: the deep state (defaults,
     * subrules) is deep-cloned once per mutation and shared from the
     * per-instance cache, while each call gets its own top-level object,
     * so mutating the result never touches the live rule. A function
     * default is preserved as-is (by reference) where a JSON roundtrip
     * would drop it. The result must be treated as read-only
     *
     * !!! hide for external users !!!
     * @private
    */
    export() {
        const cache = this.exported || (this.exported = BasicType.clone(this.rule));
        return { ...cache, rules: cache.rules.slice() };
    }
    /**
     * This method will be executed when converting a Rule object to JSON
     *
     * Returns a safe copy (see export()): mutating the result never
     * touches the live rule
    */
    toJSON() {
        return this.export();
    }
    /**
     * Invalidates the cached export
     *
     * Must be called by every method that mutates the rule, so that the
     * next export() reflects the new state of the rule
     */
    invalidateExport() {
        this.exported = undefined;
    }
    /**
     * Adds a subrule (a constraint) to the rule
     *
     * The name is a SubruleName (see SubruleNames): a typo in the name
     * is a compile error
     *
     * @param name Name of the subrule (one of SubruleNames)
     * @param args Arguments of the subrule
     */
    addSubrule(name, args) {
        this.invalidateExport();
        this.rule.rules.push({ name, args });
    }
    /**
     * Dispatches all subrules of the rule to their checkers (the checkers table)
     *
     * A subrule name that has no registered checker never passes silently:
     * it fails with VR_TYPE_NOT_EXISTS (fail-closed)
     *
     * @param obj Validation object
     * @param key Key for getting value from object
     */
    checkSubrules(obj, key) {
        for (const sub of this.rule.rules) {
            const checker = this.checkers.get(sub.name);
            if (!checker)
                throw ErrorManager_1.default.make('VR_TYPE_NOT_EXISTS', { key, name: sub.name });
            checker(obj, key, sub);
        }
    }
    /**
     * Performs general validation rules
     *
     * Returns false when the value is absent (undefined) and the rule is
     * not required: the caller must skip the type check for the field
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    basicValidate(obj, key) {
        this.checkDefault(obj, key);
        this.checkRequire(obj, key);
        return obj[key] !== undefined;
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
            obj[key] = BasicType.clone(this.rule.default);
    }
    /**
     * Returns a safe copy of a value
     *
     * Primitives and functions are returned as-is. Objects and arrays are
     * deep-cloned (structuredClone when available, a recursive plain clone
     * otherwise) so that a change in one validated object can never mutate
     * the rule default or another validated object
     *
     * @param value Value to clone
    */
    static clone(value) {
        if (value === null || typeof value !== 'object')
            return value;
        const structuredClone = globalThis.structuredClone;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            }
            catch (e) { /* fall through to the manual clone */ }
        }
        if (Array.isArray(value))
            return value.map((item) => BasicType.clone(item));
        const result = {};
        for (const k of Object.keys(value))
            result[k] = BasicType.clone(value[k]);
        return result;
    }
    /**
     * Checks the required flag of the rule
     *
     * Only undefined means "absent" here; an explicit null is present and
     * is left to the type check of the rule.
     * An absent value fails only when the rule is required(); otherwise
     * the field is optional and passes
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    checkRequire(obj, key) {
        if (obj[key] !== undefined)
            return;
        if (this.rule.require)
            throw ErrorManager_1.default.make('VR_ERROR_REQUIRED', { key });
    }
}
exports.default = BasicType;
ErrorManager_1.default.registerMany('Validator', [
    {
        short: 'VR_ERROR_REQUIRED',
        description: 'A value is required'
    },
]);
