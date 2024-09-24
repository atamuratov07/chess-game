import { Move } from '../core/models/move'

export interface GameMove {
	num: number
	side: 'white' | 'black'
	from: string
	to: string
	san: string
}

export type GameMoveInternal = GameMove & { move: Move }
