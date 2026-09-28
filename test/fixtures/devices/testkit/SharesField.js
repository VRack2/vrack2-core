/*
 * Test fixture devices: `shares` class field declaration (plain JS devices).
 *
 * Plain JS on purpose — exactly what real-world JS devices do: a subclass field
 * `shares = {...}` is the initial state (the base-class field is a plain object,
 * the subclass field simply overrides it).
 */
import { Device } from 'vrack2-core'

/** Field default only: `shares = {...}` becomes the initial state */
class SharesFieldDefault extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldDefault', cc) }
    shares = { data: 1 }
}

/** Field default refined in onRegister() — the refinement must be preserved */
class SharesFieldRefine extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldRefine', cc) }
    shares = { data: 1 }
    onRegister() { this.shares.data = 99 }
}

/** Field default replaced in onRegister() — the replacement must win */
class SharesFieldReplace extends Device {
    constructor(id, cc) { super(id, 'testkit.SharesFieldReplace', cc) }
    shares = { data: 1 }
    onRegister() { this.shares = { data: 2, extra: true } }
}

export default { SharesFieldDefault, SharesFieldRefine, SharesFieldReplace }