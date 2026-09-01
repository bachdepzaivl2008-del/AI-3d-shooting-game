import './style.css'
import { Game } from './game/core/Game.js'
import { gameConfig } from './game/config/gameConfig.js'
import { runCollisionBrowserProbe } from './client/diagnostics/runCollisionBrowserProbe.js'

async function bootstrap() {
  await runCollisionBrowserProbe(gameConfig)

  const game = new Game(gameConfig)
  game.start()
}

bootstrap().catch((error) => {
  console.error('Game bootstrap failed', error)
})
