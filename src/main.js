import './style.css'
import { Game } from './game/core/Game.js'
import { gameConfig } from './game/config/gameConfig.js'
import { runCollisionBrowserProbe } from './client/diagnostics/runCollisionBrowserProbe.js'
import {
  DeveloperLogger,
  installGlobalErrorBoundary,
} from './shared/logging/DeveloperLogger.js'

const logger =
  new DeveloperLogger('bootstrap')

installGlobalErrorBoundary(logger)

async function bootstrap() {
  await runCollisionBrowserProbe(gameConfig)

  const game = await Game.create(gameConfig)
  game.start()

  logger.info('Game started')
}

bootstrap().catch((error) => {
  logger.error(
    'Game bootstrap failed',
    error
  )
})
