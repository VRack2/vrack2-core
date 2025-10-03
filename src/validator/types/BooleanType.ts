/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"

export default class BooleanType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'boolean'
    }
    
    /**
     * Setting the default value
    */
    default(def: boolean) {
        this.rule.default = def
        return this
    }

    /**
     * Example of a valid value for this rule
     * 
     * @param ex Example valid value 
    */
    example(ex: boolean){
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
        if (typeof obj[key] !== 'boolean') throw ErrorManager.make('VR_IS_NOT_BOOLEAN', { key })
        return true
    }
}

ErrorManager.register(
    'Validator', 'Fr7BvAlZyZPm', 'VR_IS_NOT_BOOLEAN',
    'Value must be a number', {
})