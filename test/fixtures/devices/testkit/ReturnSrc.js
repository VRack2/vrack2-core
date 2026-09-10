/*
 * Test fixture device with a `return` type output port.
 * Used to verify CTR_INCOMPATIBLE_PORTS when connecting to a `standard` port.
 */
import { Device, Port } from 'vrack2-core'

export default class ReturnSrc extends Device {
    outputs() {
        return {
            res: Port.return(),
        }
    }
}