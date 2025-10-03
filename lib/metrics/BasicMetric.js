"use strict";
/*
 * Copyright © 2025 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
const vrack_db_1 = require("vrack-db");
/**
 * Metric base class. Used internally to define device metrics.
*/
class BasicMetric {
    constructor() {
        /**
         * Default metric setting
        */
        this.metric = {
            retentions: '5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y',
            interval: 's',
            vType: vrack_db_1.StorageTypes.Float,
            tType: vrack_db_1.StorageTypes.Uint64
        };
    }
    /**
     * Defines the type of time storage
     *
     * @param type StorageTypes type like a StorageTypes.Uint64 (default)
    */
    timeStorage(type) {
        this.metric.tType = type;
        return this;
    }
    /**
     *  Defines the type of value storage
     *
     * @param type StorageTypes type like a StorageTypes.Uint64 (default)
    */
    valueStorage(type) {
        this.metric.vType = type;
        return this;
    }
    /**
     * Specifies the accuracy and storage period size of Graphite-style metrics
     *
     *
     * @see SingleDB.metric
     * @param req retentions Graphite-style `5s:10m, 1m:2h, 15m:1d, 1h:1w, 6h:1mon, 1d:1y`
    */
    retentions(req) {
        this.metric.retentions = req;
        return this;
    }
    /**
     * Metric Description
     *
     * @param des Short text description of the metric
    */
    description(des) {
        this.metric.description = des;
        return this;
    }
    /**
     * To add additional data to the metric, you can specify
     * any object describing the metric in this method.
     *
     * @param add Additional information for the metric
    */
    additional(add) {
        this.metric.additional = add;
        return this;
    }
    /**
     * Returns the internal metric settings object. Used inside Container
     * @private
    */
    export() {
        return this.metric;
    }
}
exports.default = BasicMetric;
