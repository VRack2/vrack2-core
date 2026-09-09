import IValidationProblem from "./validator/IValidationProblem";
/**
 * Result of a dry-run validation check (`checkDevice` / `checkConnection`).
 *
 * - `valid: true`  — the configuration is correct and can be safely applied.
 * - `valid: false` — the configuration is invalid. `error` describes the first
 *   problem found. For device option checks `problems` may list detailed
 *   validation problems.
 *
 * This type lets external systems validate a device/connection config
 * (pre-check) without side effects and without handling exceptions.
 */
export interface ICheckResult {
    /** Whether the checked configuration is valid */
    valid: boolean;
    /** Error description (present only when `valid === false`) */
    error?: {
        /** VRack Error Manager short code (e.g. `CTR_DEVICE_DUPLICATE`) */
        code: string;
        /** Human readable error message */
        message: string;
    };
    /** Detailed validation problems (device option checks only) */
    problems?: Array<IValidationProblem>;
}
export default ICheckResult;
