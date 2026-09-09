/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import BasicPort from "./BasicPort"

export default class StandardPort extends BasicPort {
    constructor() {
        super()
        this.port.type = 'standard'
    }
}
