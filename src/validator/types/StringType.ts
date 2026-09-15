/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule, { SubruleNames } from "../IValidationSubrule"

export default class StringType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'string'
        this.checkers.set(SubruleNames.maxLength, (obj, key, sub) => this.checkMaxLength(obj, key, sub))
        this.checkers.set(SubruleNames.minLength, (obj, key, sub) => this.checkMinLength(obj, key, sub))
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: string): this {
        this.invalidateExport()
        this.rule.example = ex
        return this
    }
    
    /**
     * Setting the default value
    */
    default(def: string) {
        this.invalidateExport()
        this.rule.default = def
        return this
    }

    /**
     * Sets the maximum length of the string
    */
    maxLength(max: number) {
        this.addSubrule(SubruleNames.maxLength, max)
        return this
    }

    /**
     * Sets the minimum length of the string
    */
    minLength(min: number) {
        this.addSubrule(SubruleNames.minLength, min)
        return this
    }

    /**
     * Method of validation of this type
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: {[key:string]: any}, key: string){
        if (!this.basicValidate(obj, key)) return true
        if (typeof obj[key] !== 'string') throw ErrorManager.make('VR_IS_NOT_STRING', { key })
        this.checkSubrules(obj, key)
        return true
    }

    /**
     * Checking the maximum string length
    */
    protected checkMaxLength(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        const val = obj[key]
        if (val.length > sub.args) throw ErrorManager.make('VR_STRING_MAX_LENGTH', { limit: sub.args, key })
    }

    /**
     * Checking the minimum string length
    */
    protected checkMinLength(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        const val = obj[key]
        if (val.length < sub.args) throw ErrorManager.make('VR_STRING_MIN_LENGTH', { limit: sub.args, key })
    }

}

ErrorManager.register(
    'Validator', 'VR_IS_NOT_STRING',
    'Value must be a string', {
})

ErrorManager.register(
    'Validator', 'VR_STRING_MAX_LENGTH',
    'The maximum string length is limited', {
})

ErrorManager.register(
    'Validator', 'VR_STRING_MIN_LENGTH',
    'The minimum string length is limited', {
})