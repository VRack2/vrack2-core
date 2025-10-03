/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BasicMetric from "./BasicMetric";

/**
 * Creating a new metric with minimum time unit in milliseconds
 * 
 * @see BasicMetric
*/
export default class IvMS extends BasicMetric {
    constructor (){
        super()
        this.metric.interval = 'ms'
    }
}
