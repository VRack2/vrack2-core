import BootDatabaseSqlite from './BootDatabaseSqlite';
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
    checkOptions(): {
        file: import("../validator/types/StringType").default;
        wal: import("../validator/types/BooleanType").default;
        readOnly: import("../validator/types/BooleanType").default;
    };
}
