/*
 * Test fixture device: publishes a live object reference into the container's
 * resource registry via Container.publish().
 *
 * - onStartAsync(): creates a simple object and publishes it as 'Provider.data'
 * - action 'update': mutates the published object (proves it's a live reference)
 */
import { Device, Action, Rule } from 'vrack2-core'

export default class ResourceProvider extends Device {
    actions() {
        return {
            update: Action.global().requirements({
                v: Rule.number().required().description('New value'),
            }).description('Update the published resource value'),
        }
    }

    async onStartAsync() {
        this.published = { value: 42, items: ['a', 'b'] }
        this.Container.publish('Provider.data', this.published)
        this.shares.published = true
    }

    actionUpdate(data) {
        this.published.value = data.v
        return this.published.value
    }
}
