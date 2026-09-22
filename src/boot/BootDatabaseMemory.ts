/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import BootDatabaseSqlite from './BootDatabaseSqlite'
import Rule from '../validator/Rule'

/**
 * In-memory SQLite adapter: {@link BootDatabaseSqlite} with the `file`
 * option defaulting to `:memory:`, so a database instance with no options
 * is a pure in-memory database (no disk file, data lives as long as the
 * process). It still accepts an explicit `file` path — such an instance then
 * behaves exactly as `BootDatabaseSqlite` (a regular file database).
 *
 * Use it where a throwaway database is wanted (tests, scratch data); use
 * {@link BootDatabaseSqlite} for data that must survive the process.
 *
 * @extends BootDatabaseSqlite
 */
export default class BootDatabaseMemory extends BootDatabaseSqlite {

    /**
     * Options: the `file` option of {@link BootDatabaseSqlite} with the
     * default changed to `:memory:`; `wal`/`readOnly` are inherited
     * (both are no-ops for an in-memory database).
     */
    checkOptions() {
        return {
            file: Rule.string().required().default(':memory:').description('Path to the database file; defaults to ":memory:" — a pure in-memory database'),
            wal: Rule.boolean().required().default(true).description('Inherited, no effect on ":memory:"'),
            readOnly: Rule.boolean().required().default(false).description('Inherited, no effect on ":memory:"')
        }
    }
}
