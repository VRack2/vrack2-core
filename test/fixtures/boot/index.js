/*
 * Boot-class fixtures for integration tests.
 * Imported as `testkit.GoodBoot`, `testkit.NotABoot`, etc. (see vitest.config.mts alias).
 */
import { BootClass, Rule } from 'vrack2-core'

/**
 * A correct boot class. Records the order of process()/processPromise() calls.
 */
class GoodBoot extends BootClass {
    static calls = []
    process() {
        GoodBoot.calls.push('process')
    }
    async processPromise() {
        GoodBoot.calls.push('processPromise')
    }
}

/**
 * A plain class that is NOT a BootClass.
 * Used to verify BTSP_INSTANCE_OF_INCORRECT.
 */
class NotABoot {
    constructor(id, type, Container, options) {
        this.id = id
        this.type = type
        this.Container = Container
        this.options = options
    }
}

/**
 * Boot class with a required option (no default) - option must be provided.
 */
class OptionsBoot extends BootClass {
    checkOptions() {
        return {
            token: Rule.string().required().description('Required token'),
        }
    }
}

/**
 * Boot class with a default option value - the validator must fill it.
 */
class DefaultBoot extends BootClass {
    checkOptions() {
        return {
            port: Rule.number().default(8080).description('Service port'),
        }
    }
}

export { GoodBoot, NotABoot, OptionsBoot, DefaultBoot }