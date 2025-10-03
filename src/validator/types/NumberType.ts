/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule from "../IValidationSubrule"

export default class NumberType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'number'
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: number){
        this.rule.example = ex
        return this
    }

    /**
     * Setting the default value
    */
    default(def: number) {
        this.rule.default = def
        return this
    }

    /**
     * Adds an integer check
    */
    integer(){
        this.rule.rules.push({ name: 'integer', args: {} })
        return this;
    }

    /**
     * Defines the maximum value for the rule
    */
    max(max: number) {
        this.rule.rules.push({ name: 'max', args: max })
        return this
    }

    /**
     * Defines the minimal value for the rule
    */
    min(min: number) {
        this.rule.rules.push({ name: 'min', args: min })
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
        if (typeof obj[key] !== 'number') throw ErrorManager.make('VR_IS_NOT_NUMBER', { key })
        for (const subrule of this.rule.rules){
            switch (subrule.name){
                case 'integer':
                    this.checkInteger(obj, key)
                    break
                case 'max':
                    this.checkMax(obj, key, subrule)
                    break
                case 'min':
                    this.checkMin(obj, key, subrule)
                    break
            }
        }
        return true
    }

    /**
     *  Checking the maximum value
    */
    protected checkMax(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        if (obj[key] > sub.args) throw ErrorManager.make('VR_NUMBER_MAX', { limit: sub.args })
    }

    /**
     *  Checking the minimal value
    */
    protected checkMin(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        if (obj[key] < sub.args) throw ErrorManager.make('VR_NUMBER_MIN', { limit: sub.args })
    }

    /**
     * Integer check
    */
    protected checkInteger(obj: {[key:string]: any}, key: string){
        if (!Number.isInteger(obj[key])) throw ErrorManager.make('VR_NUMBER_INTEGER', {})
    }
}


ErrorManager.register(
    'Validator', 'pn7B9po1UGRp', 'VR_IS_NOT_NUMBER',
    'Value must be a number', {
})

ErrorManager.register(
    'Validator', 'fiUqanqqFlnt', 'VR_NUMBER_INTEGER',
    'Value must be a integer', {
})

ErrorManager.register(
    'Validator', 'ZFSMAes0qdzC', 'VR_NUMBER_MAX',
    'Number out of limit', {
})

ErrorManager.register(
    'Validator', 'B3zqsPub40HH', 'VR_NUMBER_MIN',
    'Number out of limit', {
})