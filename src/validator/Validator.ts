/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import util from "util"

import ErrorManager from "../errors/ErrorManager";
import BasicType from "./types/BasicType";
import CoreError from "../errors/CoreError";
import IValidationProblem from './IValidationProblem';
import IValidationRule from "./IValidationRule";

ErrorManager.register(
    'Validator', 'VXLeMLVnIXGf', 'VR_TYPE_NOT_EXISTS',
    'Type not exists', {
})

ErrorManager.register(
    'Validator', 'X1UP4P2HRHWd', 'VR_NOT_PASS',
    'Validation error - data not pass', {
})

export default class Validator {
    
    /**
     * Validation of the object by rule.
     * You cannot validate a specific value. 
     * You can only validate an object property.
     * 
     * For validation you need to create an object with rules 
     * 
     * ```ts
     * const rules = {
     *    bool: Rule.boolean().require().default(true).description('Boolean checkbox')
     * }
     * ```
     * 
     * After validating the object with the same properties
     * 
     * ```
     * Validator.validate(rules, { bool: 'not a boolean value?'})
     * ```
     * 
     * @param rules List of rules like a associate object
     * @param data Data object for validate
    */
    static validate(rules: {[key:string]: BasicType},data: {[key:string]: any}) : boolean {
        const problems: Array<IValidationProblem> = []
        for (const key of Object.keys(rules)){
            const rule = rules[key]
            try {
                rule.validate(data, key)
            } catch (err){
                if (err instanceof CoreError) problems.push(Validator.makeProblem(err, key, rule.export(), data[key]))
            }
        }
        if (problems.length) Validator.makeError(problems)
        return true;
    }

    /**
     * Creates a top-level error for validation problems
     * 
     * @param eList List of validation errors
    */
    protected static makeError(eList: Array<IValidationProblem>){
        throw ErrorManager.make('VR_NOT_PASS', {
            problems: eList
        })
    }
    
    /**
     * Create validation problem
     * 
     * @param err Validation exception
     * @param key key for getting value from object
     * @param rule Checked rule
    */
    protected static makeProblem(err: CoreError, key: string, rule: IValidationRule, value: any) : IValidationProblem {
        if (rule.message) err.message = this.makeMessage(rule, value)
        const nvp:IValidationProblem = {
            type: err.vShort, code: err.vCode, fieldKey: key, description: err.message, rule, arg: {}
        }
        for (const sk of err.vAdd) nvp.arg[sk] = err[sk as keyof CoreError]
        return nvp
    }

    /**
     * Make message use message template
     * 
     * If you want to change the default message, you can use a template in the message parameter
     * 
     * @example
     * ```js
     *  Rule.number().description('My number').message('{description} must by 1,2,3,4,5,6... not {value}')
     * ```
    */
    protected static makeMessage(rule: IValidationRule, value: any ): string {
        let message = rule.message
        const val = Validator.toInspect(value)
        const example = Validator.toInspect(rule.example)
        const def = Validator.toInspect(rule.default)
        
        message.replace('{value}', val)
        message.replace('{example}', example)
        message.replace('{default}', def)
        message.replace('{description}', rule.description)
        return message
    }

    protected static toInspect(value:any){
        if (typeof value === "object" || typeof value === "function"){
            return util.inspect(value, { showHidden: false, depth: null, compact: false }) 
        }
        return value
    }
}
