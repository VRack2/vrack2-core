/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import ReturnPort from "./ReturnPort";
import StandartPort from "./StandartPort";
import StandardPort from "./StandardPort";
/**
 * Creating a new port. Used internally to create a port
*/
export default class Port {
    
    /**
     * Standard Port. 
     * Used to cast a value to another port or to signal a value to another port
    */
    static standard() {
        return new StandardPort()
    }

    /**
     * @deprecated Use `Port.standard()` instead.
     */
    static standart() {
        return new StandartPort()
    }

    /**
     * Return Port. Used to get the value over connections
    */
    static return() {
        return new ReturnPort()
    }
}
