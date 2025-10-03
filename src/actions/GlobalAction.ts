/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicAction from "./BasicAction";

/**
 * Standart action class
 * 
 * @see BasicAction
*/
export default class GlobalAction extends BasicAction {

    constructor() {
        super()
        this.action.type = 'global'
    }
}
