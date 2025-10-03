/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType";
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule from "../IValidationSubrule";
import Validator from "../Validator";
import CoreError from "../../errors/CoreError";

export default class ArrayType extends BasicType {
    constructor() {
        super()
        this.rule.type = 'array'
    }

    /**
     * Setting the default value
    */
    default(def: Array<any>) {
        this.rule.default = def
        return this
    }

    /**
     * Sets the rule to be applied to each element of the array
     * 
     * @example 
     * 
     * ```
     * Rule.array().require().content(
     *    Rule.string().default('').maxLength(24).description('Element of list')
     * )
     * ```
     * 
    */
    content(t: BasicType) {
        this.rule.rules.push({ name: 'contain', args: t })
        return this
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: Array<any>){
        this.rule.example = ex
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
        if (!Array.isArray(obj[key])) throw ErrorManager.make('VR_IS_NOT_ARRAY', {})
        for (const subrule of this.rule.rules) {
            switch (subrule.name) {
                case 'fields':
                    this.checkContent(obj, key, subrule)
            }
        }
        return true
    }

    /**
     * Checks the rules for content inside the array
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
     * @param sub Sub rule for check array content 
    */
    protected checkContent(obj: { [key: string]: any }, key: string, sub: IValidationSubrule) {
        const sw = { value: undefined }
        const tr = { value: sub.args }
        for (const index of obj[key]) {
            sw.value = obj[key][index]
            try {
                Validator.validate(tr, sw)
            } catch (error) {
                if (error instanceof CoreError) {
                    throw ErrorManager.make('VR_ARRAY_CONTENT_ERROR', { index }).add(error)
                }
            }
        }
    }

}

ErrorManager.register(
    'Validator', '3U9s3ZsTH6FA', 'VR_IS_NOT_ARRAY',
    'Value must be a array', {
})

ErrorManager.register(
    'Validator', 'Eg9cIXlxi1yP', 'VR_ARRAY_CONTENT_ERROR',
    'Validation error inside the array data', {
})
