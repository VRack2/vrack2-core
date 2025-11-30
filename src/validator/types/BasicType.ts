/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import ErrorManager from "../../errors/ErrorManager"
import IValidationRule from "../IValidationRule"

export default class BasicType {
    protected rule: IValidationRule

    constructor() {
        this.rule = {
            type: '',
            require: false,
            default: undefined,
            rules: [],
            example: undefined,
            description: '',
            message: '',
        }
    }

    required(){
        this.rule.require = true
        return this
    }
    
    /**
     * Вскоре будет удален
     * @see required
     * @deprecated use required()
    */
    require(){
        this.rule.require = true
        return this
    }
    
    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: any){
        this.rule.example = ex
        return this
    }

    /**
     * Description of the validated object property
     * 
     * @param desc 
    */
    description(desc: string){
        this.rule.description = desc
        return this
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
     * Use {description} {value} {default} {example} in template 
    */
    message(mess: string){
        this.rule.message = mess
        return this
    }

    /**
     * Exporting a rule for use
     * Typically used within VRack or VRack-Core
     * 
     * !!! hide for external users !!!
     * @private
    */
    export() {
        return JSON.parse(JSON.stringify(this.rule))
    }

    /**
     * This method will be executed when converting a Rule object to JSON
    */
    toJSON(){
        return this.rule
    }

    /**
     * Performs general validation rules
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected basicValidate(obj: {[key:string]: any}, key: string) :boolean {
        this.checkDefault(obj, key)
        this.checkRequire(obj, key)
        return true;
    }

    /**
     * Method of validation of this type
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj: {[key:string]: any}, key: string){
        return true
    }

    /**
     * Sets the default value if it has not been set
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected  checkDefault(obj: {[key:string]: any}, key: string) {
        if (this.rule.default === undefined) return 
        if (obj[key] === undefined) obj[key] = this.rule.default
    }

    /**
     * Checks if the initialized property of an object
     * 
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    protected  checkRequire(obj: {[key:string]: any}, key: string) {
        if (obj[key] === undefined) throw ErrorManager.make('VR_ERROR_REQUAERED', { key })
    }
}

ErrorManager.register(
    'Validator', 'Jwg5Mr1NqaSj', 'VR_ERROR_REQUAERED',
    'A value is required', {
})
