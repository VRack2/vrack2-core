/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType";
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule, { SubruleNames } from "../IValidationSubrule";
import Validator from "../Validator";

export default class ArrayType extends BasicType {
    constructor() {
        super()
        this.rule.type = 'array'
        this.checkers.set(SubruleNames.contain, (obj, key, sub) => this.checkContent(obj, key, sub))
    }

    /**
     * Setting the default value
    */
    default(def: Array<any>) {
        this.invalidateExport()
        this.rule.default = def
        return this
    }

    /**
     * Sets the rule to be applied to each element of the array
     * 
     * @example 
     * 
     * ```
     * Rule.array().required().content(
     *    Rule.string().default('').maxLength(24).description('Element of list')
     * )
     * ```
     * 
    */
    content(t: BasicType) {
        this.addSubrule(SubruleNames.contain, t)
        return this
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: Array<any>){
        this.invalidateExport()
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
        if (!this.basicValidate(obj, key)) return true
        if (!Array.isArray(obj[key])) throw ErrorManager.make('VR_IS_NOT_ARRAY', { key })
        this.checkSubrules(obj, key)
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
        const items = obj[key]
        for (let index = 0; index < items.length; index++) {
            sw.value = items[index]
            try {
                Validator.validate(tr, sw)
            } catch (error) {
                // Fail-closed: any exception on an element fails the array
                const e = (error instanceof Error) ? error : new Error(String(error))
                throw ErrorManager.make('VR_ARRAY_CONTENT_ERROR', { key, index }).add(e)
            }
        }
    }

}

ErrorManager.register(
    'Validator', '3U9s3ZsTH6FA', 'VR_IS_NOT_ARRAY',
    'Value must be an array', {
})

ErrorManager.register(
    'Validator', 'Eg9cIXlxi1yP', 'VR_ARRAY_CONTENT_ERROR',
    'Validation error inside the array data', {
})
