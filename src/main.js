import './style.css'
import { Game } from './game/core/Game.js'
import { gameConfig } from './game/config/gameConfig.js'

const game = new Game(gameConfig)
game.start()
