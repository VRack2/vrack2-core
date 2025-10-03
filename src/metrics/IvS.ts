/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicInterval from "./BasicMetric";

/**
 * Creating a new metric with minimum time unit in Seconds
 * 
 * @see BasicMetric
*/
export default class IvS extends BasicInterval {
    constructor (){
        super()
        this.metric.interval = 's'
    }
}
