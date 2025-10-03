/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import Validator from "../Validator";
import IValidationSubrule from "../IValidationSubrule";
import CoreError from "../../errors/CoreError";

export default class ObjectType extends BasicType {
    constructor() {
        super()
        this.rule.type = 'object'
    }


    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: any) {
        this.rule.example = ex
        return this
    }


    /**
     * Setting the default value
    */
    default(def: object) {
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
     *  }).description('TEst ibject description'),
     * ```
    */
    fields(obj: { [key: string]: BasicType }) {
        this.rule.rules.push({ name: 'fields', args: obj })
        return this
    }

    /**
     * Method of validation of this type
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: { [key: string]: any; }, key: string): boolean {
        this.basicValidate(obj, key)
        if (typeof obj[key] !== 'object') throw ErrorManager.make('VR_IS_NOT_OBJECT', {})
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'fields':
                    this.subValidate(obj, key, subrule)
                    break
            }
        }
        return true
    }

    /**
     * Validate object fields 
    */
    protected subValidate(obj: { [key: string]: any }, key: string, sub: IValidationSubrule) {
        try {
            Validator.validate(sub.args, obj[key])
        } catch (error) {
            if (error instanceof Error) {
                throw ErrorManager.make('VR_ERROR_OBJECT_FIELDS', { key }).add(error)
            }
        }
    }
}

ErrorManager.register(
    'Validator', 'zOPzOab9oLum', 'VR_IS_NOT_OBJECT',
    'Value must be a object', {
})

ErrorManager.register(
    'Validator', 'p7qSfRGixV0M', 'VR_ERROR_OBJECT_FIELDS',
    'Error of validation of fields inside the object', {}
)
