/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"
import ErrorManager from "../../errors/ErrorManager"

export default class FunctionType extends BasicType {
    constructor() {
        super()
        this.rule.type = 'function'
    }
    
    /**
     * Setting the default value
    */
    default(def: () => any) {
        this.rule.default = def
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
        if (typeof obj[key] !== 'function') throw ErrorManager.make('VR_IS_NOT_FUNCTION', { key })
        return true
    }
}

ErrorManager.register(
    'Validator', 'P2K7PE7C3JRU', 'VR_IS_NOT_FUNCTION',
    'Value must be a function', {
})