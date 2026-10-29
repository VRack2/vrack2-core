"use strict";
/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A single metric declaration (created via `Metric.one()`).
 *
 * Metadata only — storage, retention and time unit belong to the metrics
 * engine. Use it as a map value in `Device.metrics()` under the exact
 * metric name.
 */
class MetricOne {
    constructor() {
        /**
         * Declaration settings.
         */
        this.metric = { kind: 'one' };
    }
    /**
     * Metric description.
     *
     * @param des Short text description of the metric
     */
    descriptions(des) {
        this.metric.description = des;
        return this;
    }
    /**
     * Additional information for the metric — any object describing it.
     *
     * @param add Additional information
     */
    additional(add) {
        this.metric.additional = add;
        return this;
    }
    /**
     * Export the declaration (used by the Container/structure).
     */
    export() {
        return { ...this.metric };
    }
}
exports.default = MetricOne;
