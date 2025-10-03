/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "./BasicType"

export default class AnyType  extends BasicType {
    constructor() {
        super()
        this.rule.type = 'any'
    }

    /**
     * Setting the default value
    */
    default(def: any) {
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
        return true
    }
}