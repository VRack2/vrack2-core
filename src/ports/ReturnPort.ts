/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicType from "../validator/types/BasicType"
import BasicPort from "./BasicPort"

export default class ReturnPort extends BasicPort {
    constructor() {
        super()
        this.port.type = 'return'
    }

    /**
     * Specifies a recommendation to the data return from the port.
     * 
     * @param req BasicType type 
    */
    return(req:  BasicType ){
        this.port.return = req
        return this
    }
}
