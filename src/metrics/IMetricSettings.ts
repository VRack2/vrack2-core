/*
 * Copyright © 2026 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Exported metric declaration (from `Metric.one()` / `Metric.group()`).
 *
 * Carries metadata only: storage settings (retention, time unit, storage
 * types) are the metrics engine's concern, not the device's.
 */
export default interface IMetricSettings {
    /**
     * Declaration kind: a single metric (`'one'`) or a wildcard group
     * (`'group'`, declared under a key containing `*`).
     */
    kind: 'one' | 'group';

    /**
     * Human-readable description (group: of the whole group).
     */
    description?: string;

    /**
     * Additional information for the metric (any object).
     */
    additional?: any;

    /**
     * Known group members (groups only): member name (the `*` part) →
     * its declaration. Not exhaustive — a group accepts any name matching
     * its pattern.
     */
    list?: { [name: string]: IMetricSettings };
}
