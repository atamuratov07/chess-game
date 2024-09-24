import { Board } from '../models/board'
import { listAllValidMoves } from './list-valid-moves'
import { performMove } from './perform-move'

/**
 * Count the number of plays given the provided depth. Used to verify the move generator.
 *
 * @param board
 * @param depth
 */
export function perft(board: Board, depth: number): number {
	let num = 0
	const moves = listAllValidMoves(board, board.current.turn)
	if (depth <= 1) return moves.length

	for (const move of moves) {
		board.save()
		performMove(board, move)
		const deep = perft(board, depth - 1)
		num += deep
		board.restore()
	}

	return num
}
