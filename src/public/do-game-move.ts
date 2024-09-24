import { findMoveBySAN } from '../core/logic/find-move-by-san'
import { listAllValidMoves } from '../core/logic/list-valid-moves'
import { moveToSAN } from '../core/logic/move-formats/move-to-san'
import { checkMoveResults } from '../core/logic/move-results'
import { performMove } from '../core/logic/perform-move'
import { Board } from '../core/models/board'
import { ChessBadMove, ChessNeedsPromotion } from '../core/models/chess-error'
import { COLOR_WHITE } from '../core/models/color'
import { coordFromAN, coordToAN } from '../core/models/coord'
import {
	PIECETYPE_BISHOP,
	PIECETYPE_KNIGHT,
	PIECETYPE_QUEEN,
	PIECETYPE_ROOK,
	PieceType,
} from '../core/models/piece-type'
import { GameMoveInternal } from './game-move'

type ObjectMove = {
	from: string
	to: string
	promotion?: string
}

const UCI_MOVE_RE = /^([a-h][1-8])[- ]*([a-h][1-8])([bnrqBNRQ])?$/

const PROMOTE_MAP: { [type: string]: PieceType } = {
	N: PIECETYPE_KNIGHT,
	B: PIECETYPE_BISHOP,
	R: PIECETYPE_ROOK,
	Q: PIECETYPE_QUEEN,
}

export function doGameMove(
	board: Board,
	move: string | ObjectMove
): GameMoveInternal {
	if (typeof move === 'object') {
		return _objectMove(board, move)
	}
	const match = move.match(UCI_MOVE_RE)
	if (match) {
		return _uciMove(board, match[1], match[2], match[3])
	}

	// Else, possibly SAN:
	return _sanMove(board, move)
}

function _uciMove(
	board: Board,
	from: string,
	dest: string,
	promote: string
): GameMoveInternal {
	const fromIdx = coordFromAN(from),
		destIdx = coordFromAN(dest)
	let promoteType: PieceType | 0 = 0

	if (promote) {
		promoteType = PROMOTE_MAP[promote.toUpperCase()]
		if (!promoteType) {
			throw new ChessBadMove(`Invalid promotion: ${promote}`)
		}
	}

	const turn = board.current.turn
	const moves = listAllValidMoves(board, turn)
	const picked = moves.find(
		move =>
			move.from === fromIdx &&
			move.to === destIdx &&
			(promoteType ? move.promote === promoteType : true)
	)

	if (!picked) {
		throw new ChessBadMove(`Invalid move: ${from}${dest}${promote || ''}`)
	}

	if (picked.promote && !promoteType) {
		throw new ChessNeedsPromotion()
	}

	const num = board.current.moveNum

	// Else, we have the correct move! Apply to to our own board:
	performMove(board, picked)

	const results = checkMoveResults(board, turn)
	board.current.status = results.newGameStatus

	return {
		num,
		side: turn === COLOR_WHITE ? 'white' : 'black',
		from,
		to: dest,
		san: moveToSAN(moves, picked, results),
		move: picked,
	}
}

function _sanMove(board: Board, san: string): GameMoveInternal {
	const turn = board.current.turn
	const moves = listAllValidMoves(board, turn)
	const move = findMoveBySAN(moves, san)
	const num = board.current.moveNum

	performMove(board, move)

	const results = checkMoveResults(board, turn)
	board.current.status = results.newGameStatus

	return {
		num,
		side: turn === COLOR_WHITE ? 'white' : 'black',
		from: coordToAN(move.from),
		to: coordToAN(move.to),
		san: moveToSAN(moves, move, results),
		move,
	}
}

function _objectMove(board: Board, move: ObjectMove): GameMoveInternal {
	const fromIdx = coordFromAN(move.from)
	const toIdx = coordFromAN(move.to)
	let promoteType: PieceType | 0 = 0

	if (move.promotion) {
		promoteType = PROMOTE_MAP[move.promotion.toUpperCase()]
		if (!promoteType) {
			throw new ChessBadMove(`Invalid promotion: ${move.promotion}`)
		}
	}

	const num = board.current.moveNum
	const turn = board.current.turn
	const moves = listAllValidMoves(board, turn)
	const picked = moves.find(
		m =>
			m.from === fromIdx &&
			m.to === toIdx &&
			(promoteType ? m.promote === promoteType : true)
	)

	if (!picked) {
		throw new ChessBadMove(`Invalid move: ${JSON.stringify(move)}`)
	}

	if (picked.promote && !promoteType) {
		throw new ChessNeedsPromotion()
	}

	performMove(board, picked)

	const results = checkMoveResults(board, turn)
	board.current.status = results.newGameStatus

	return {
		num,
		side: turn === COLOR_WHITE ? 'white' : 'black',
		from: coordToAN(picked.from),
		to: coordToAN(picked.to),
		san: moveToSAN(moves, picked, results),
		move: picked,
	}
}
