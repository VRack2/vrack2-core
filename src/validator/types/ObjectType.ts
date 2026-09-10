/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import Validator from "../Validator";
import IValidationSubrule, { SubruleNames } from "../IValidationSubrule";

export default class ObjectType extends BasicType {
    constructor() {
        super()
        this.rule.type = 'object'
        this.checkers.set(SubruleNames.fields, (obj, key, sub) => this.subValidate(obj, key, sub))
    }


    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: any) {
        this.invalidateExport()
        this.rule.example = ex
        return this
    }


    /**
     * Setting the default value
    */
    default(def: object) {
        this.invalidateExport()
        this.rule.default = def
        return this
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
     *  }).description('Test object description'),
     * ```
    */
    fields(obj: { [key: string]: BasicType }) {
        this.addSubrule(SubruleNames.fields, obj)
        return this
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
    validate(obj: { [key: string]: any; }, key: string): boolean {
        if (!this.basicValidate(obj, key)) return true
        if (obj[key] === null || typeof obj[key] !== 'object') throw ErrorManager.make('VR_IS_NOT_OBJECT', { key })
        this.checkSubrules(obj, key)
        return true
    }

    /**
     * Validate object fields 
    */
    protected subValidate(obj: { [key: string]: any }, key: string, sub: IValidationSubrule) {
        try {
            Validator.validate(sub.args, obj[key])
        } catch (error) {
            // Fail-closed: any exception inside the fields fails the object
            const e = (error instanceof Error) ? error : new Error(String(error))
            throw ErrorManager.make('VR_ERROR_OBJECT_FIELDS', { key }).add(e)
        }
    }
}

ErrorManager.register(
    'Validator', 'zOPzOab9oLum', 'VR_IS_NOT_OBJECT',
    'Value must be an object', {
})

ErrorManager.register(
    'Validator', 'p7qSfRGixV0M', 'VR_ERROR_OBJECT_FIELDS',
    'Error of validation of fields inside the object', {}
)
