/*
 * Test fixture devices: `shares` class field declaration (plain JS devices).
 *
 * Plain JS on purpose: these exercise ES2022 class-field shadowing of the base-class
 * `shares` accessor at runtime — exactly what real-world JS devices do. The Container
 * must import such field values into the reactive ref on attach (attachSharesRender()).
 */
import { Device } from 'vrack2-core'

/** Field default only: `shares = {...}` becomes the initial state */
class SharesFieldDefault extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldDefault', cc) }
    shares = { data: 1 }
}

/** Field default refined in preProcess() — the refinement must be preserved */
class SharesFieldRefine extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldRefine', cc) }
    shares = { data: 1 }
    preProcess() { this.shares.data = 99 }
}

/** Field default replaced in preProcess() — the replacement must win */
class SharesFieldReplace extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldReplace', cc) }
    shares = { data: 1 }
    preProcess() { this.shares = { data: 2, extra: true } }
}

export default { SharesFieldDefault, SharesFieldRefine, SharesFieldReplace }