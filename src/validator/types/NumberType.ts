/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"
import IValidationSubrule, { SubruleNames } from "../IValidationSubrule"

export default class NumberType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'number'
        this.checkers.set(SubruleNames.integer, (obj, key) => this.checkInteger(obj, key))
        this.checkers.set(SubruleNames.max, (obj, key, sub) => this.checkMax(obj, key, sub))
        this.checkers.set(SubruleNames.min, (obj, key, sub) => this.checkMin(obj, key, sub))
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: number){
        this.invalidateExport()
        this.rule.example = ex
        return this
    }

    /**
     * Setting the default value
    */
    default(def: number) {
        this.invalidateExport()
        this.rule.default = def
        return this
    }

    /**
     * Adds an integer check
    */
    integer(){
        this.addSubrule(SubruleNames.integer, {})
        return this;
    }

    /**
     * Defines the maximum value for the rule
    */
    max(max: number) {
        this.addSubrule(SubruleNames.max, max)
        return this
    }

    /**
     * Defines the minimal value for the rule
    */
    min(min: number) {
        this.addSubrule(SubruleNames.min, min)
        return this
    }

    /**
     * Method of validation of this type
     * 
     * Accepts only finite numbers: NaN, Infinity and -Infinity are
     * rejected with VR_IS_NOT_NUMBER
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: { [key: string]: any; }, key: string): boolean {
        if (!this.basicValidate(obj, key)) return true
        if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key])) throw ErrorManager.make('VR_IS_NOT_NUMBER', { key })
        this.checkSubrules(obj, key)
        return true
    }

    /**
     *  Checking the maximum value
    */
    protected checkMax(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        if (obj[key] > sub.args) throw ErrorManager.make('VR_NUMBER_MAX', { limit: sub.args, key })
    }

    /**
     *  Checking the minimal value
    */
    protected checkMin(obj: {[key:string]: any}, key: string, sub: IValidationSubrule){
        if (obj[key] < sub.args) throw ErrorManager.make('VR_NUMBER_MIN', { limit: sub.args, key })
    }

    /**
     * Integer check
    */
    protected checkInteger(obj: {[key:string]: any}, key: string){
        if (!Number.isInteger(obj[key])) throw ErrorManager.make('VR_NUMBER_INTEGER', { key })
    }
}


ErrorManager.registerMany('Validator', [
    {
        short: 'VR_IS_NOT_NUMBER',
        description: 'Value must be a number'
    },
    {
        short: 'VR_NUMBER_INTEGER',
        description: 'Value must be an integer'
    },
    {
        short: 'VR_NUMBER_MAX',
        description: 'Number out of limit'
    },
    {
        short: 'VR_NUMBER_MIN',
        description: 'Number out of limit'
    },
])