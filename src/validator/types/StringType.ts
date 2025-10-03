/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule from "../IValidationSubrule"

export default class StringType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'string'
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: string): this {
        this.rule.example = ex
        return this
    }
    
    /**
     * Setting the default value
    */
    default(def: string) {
        this.rule.default = def
        return this
    }

    /**
     * Sets the maximum length of the string
    */
    maxLength(max: number) {
        this.rule.rules.push({ name: 'maxLength', args: max })
        return this
    }

    /**
     * Sets the minimum length of the string
    */
    minLength(min: number) {
        this.rule.rules.push({ name: 'minLength', args: min })
        return this
    }

    /**
     * Method of validation of this type
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: {[key:string]: any}, key: string){
        this.basicValidate(obj, key)
        if (typeof obj[key] !== 'string') throw ErrorManager.make('VR_IS_NOT_STRING', { key })
        for (const subrule of this.rule.rules){
            switch (subrule.name){
                case 'maxLength':
                    this.checkMaxLength(obj, key, subrule)
                    break
                case 'minLength':
                    this.checkMinLength(obj, key, subrule)
                    break
            }
        }
        return true
    }

    /**
     * Checking the maximum string length
    */
    protected checkMaxLength(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        const val = obj[key]
        if (val.length >= sub.args) throw ErrorManager.make('VR_STRING_MAX_LENGTH', { limit: sub.args, key })
    }

    /**
     * Checking the minimum string length
    */
    protected checkMinLength(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        const val = obj[key]
        if (val.length <= sub.args) throw ErrorManager.make('VR_STRING_MIN_LENGTH', { limit: sub.args, key })
    }

}

ErrorManager.register(
    'Validator', 'klmjxHyQrWuH', 'VR_IS_NOT_STRING',
    'Value must be a string', {
})

ErrorManager.register(
    'Validator', 'BL5lxR4BinkA', 'VR_STRING_MAX_LENGTH',
    'The maximum string length is limited', {
})

ErrorManager.register(
    'Validator', 'KsijTdsbd2YN', 'VR_STRING_MIN_LENGTH',
    'The minimum string length is limited', {
})