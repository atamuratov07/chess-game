import { Board } from '../models/board'
import { COLOR_BLACK, COLOR_WHITE } from '../models/color'
import { Move } from '../models/move'
import { SPACE_EMPTY } from '../models/space'
import { hashBoard } from './hash-board'

/**
 * Will apply a Move object to a board. Assumes that the Move is valid.
 *
 * @param b
 */
export function revertMove(b: Board, move: Move) {
	const hash = hashBoard(b)
	b.removeBoardHash(hash)

	const current = b.current

	b.set(move.from, move.what)
	b.set(move.to, SPACE_EMPTY)

	if (move.capture) {
		b.set(move.captureCoord, move.capture)
	}

	if (move.castleRook) {
		b.set(move.castleRookTo, SPACE_EMPTY)
		b.set(move.castleRookFrom, move.castleRook)
	}

	const prior = move.prior
	current.clock = prior.clock
	current.moveNum = prior.moveNum
	current.ep = prior.ep
	current.status = prior.status
	current.castles = prior.castles
	current.turn = 8 - current.turn

	current.moveCache[COLOR_WHITE] = null
	current.moveCache[COLOR_BLACK] = null
}
