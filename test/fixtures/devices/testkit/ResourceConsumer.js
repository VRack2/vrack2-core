/*
 * Test fixture device: resolves a resource from the container's resource
 * registry via Container.resolve().
 *
 * - onStartAsync(): resolves 'Provider.data' → shares.value, shares.items
 * - action 'read': returns the current value from the resolved reference
 */
import { Device, Action } from 'vrack2-core'

export default class ResourceConsumer extends Device {
    actions() {
        return {
            read: Action.global().description('Read the current value from the resolved resource'),
        }
    }

    async onStartAsync() {
        this.resolved = this.resolve('Provider.data')
        this.shares.value = this.resolved.value
        this.shares.items = this.resolved.items
    }

    actionRead() {
        return this.resolved.value
    }
}
