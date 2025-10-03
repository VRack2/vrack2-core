/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import IvMS from "./IvMs";
import IvS from "./IvS";
import IvUs from "./IvUs";

export default class Metric {
    /**
     * Creating a new metric with minimum time unit in Seconds
    */
    static inS(){ return new IvS() }
    
    /**
     * Creating a new metric with minimum time unit in Milliseconds
    */
    static inMs(){ return new IvMS() }

    /**
     * Creating a new metric with minimum time unit in Microsecond
    */
    static inUs(){ return new IvUs() }
}
