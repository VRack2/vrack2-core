/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicAction from "./BasicAction";
import GlobalAction from "./GlobalAction";

/**
 * A class for defining new actions. 
 * It is not necessary to use `new Action`. 
 * You must use the static method `Action.global` to define a new action
*/
export default class Action {

    /**
     * The only type of action game at the moment. Does not have any special properties. 
     * 
     * @see BasicAction 
    */
    static global() {
        return new GlobalAction()
    }
}
