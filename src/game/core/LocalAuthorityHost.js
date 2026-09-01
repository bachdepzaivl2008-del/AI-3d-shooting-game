import { Simulation } from './Simulation.js'
import { IntentBuffer } from '../../shared/intents/IntentBuffer.js'

export class LocalAuthorityHost {
  static async create(config) {
    const simulation = await Simulation.create(config)

    return new LocalAuthorityHost(simulation)
  }

  constructor(simulation) {
    this.simulation = simulation
    this.intentBuffer = new IntentBuffer()
    this.lastProcessedIntentCount = 0
  }

  submitIntent(intent) {
    this.intentBuffer.push(intent)
  }

  step() {
    const intents = this.intentBuffer.drain()
    this.lastProcessedIntentCount = intents.length
    this.simulation.update(intents)
  }

  getState() {
    return this.simulation.getState()
  }

  getLastProcessedIntentCount() {
    return this.lastProcessedIntentCount
  }

  dispose() {
    this.simulation.dispose()
  }
}
