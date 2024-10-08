import { coordToAN, parseCoord } from '../../models/coord'
import { Move } from '../../models/move'
import {
	PIECETYPE_BISHOP,
	PIECETYPE_KING,
	PIECETYPE_KNIGHT,
	PIECETYPE_PAWN,
	PIECETYPE_QUEEN,
	PIECETYPE_ROOK,
	PieceType,
} from '../../models/piece-type'
import { spaceGetType } from '../../models/space'
import { MoveResults } from '../move-results'

/**
 * Will render a given move in Simple Algebraic Notation. (Or Standard Notation, or Coordinate Notation...)
 *
 * Whatever you call it, it looks like "Qbxf7+".
 *
 * @param Board
 * @param move
 * @returns
 */
export function moveToSAN(
	moves: Move[],
	move: Move,
	result?: MoveResults
): string {
	let mainStr

	// Special case: Castles get their own notation.
	// Aside: FIDE uses zeros here, but we use upper-case O's to be compatible with PGN.
	if (move.castleRook) {
		mainStr =
			move.castleRookFrom < move.from
				? 'O-O-O' // Queenside
				: 'O-O' // Kingside;
	} else {
		const depart = _getDeparture(moves, move)
		const who = _anPieceType(spaceGetType(move.what))
		const capture = move.capture ? 'x' : ''
		const to = coordToAN(move.to)
		const promote = move.promote ? '=' + _anPieceType(move.promote) : ''
		mainStr = `${who}${depart}${capture}${to}${promote}`
	}

	const gamestate = result ? _checksAndMates(result) : ''
	return `${mainStr}${gamestate}`
}

// Find out the correct way to describe our departing coord:
function _getDeparture(moves: Move[], move: Move): string {
	const full = coordToAN(move.from)

	// Pawn captures always report the file of departure:
	if (spaceGetType(move.what) === PIECETYPE_PAWN && move.capture) {
		return full[0]
	}

	const similar = moves.filter(other => {
		return (
			other.from !== move.from &&
			other.to === move.to &&
			spaceGetType(other.what) === spaceGetType(move.what)
		)
	})

	// If the piece type + destination alone are enough to id this spot, that's good enough:
	if (!similar.length) return ''

	// Else, this move had a doppelgänger! Find a way to differentiate it!
	const [file, rank] = parseCoord(move.from)

	if (similar.every(other => parseCoord(other.from)[0] !== file)) {
		return full[0]
	}

	if (similar.every(other => parseCoord(other.from)[1] !== rank)) {
		return full[1]
	}

	return full
}

// Annotate the piece type:
function _anPieceType(t: PieceType): string {
	switch (t) {
		case PIECETYPE_BISHOP:
			return 'B'
		case PIECETYPE_KNIGHT:
			return 'N'
		case PIECETYPE_ROOK:
			return 'R'
		case PIECETYPE_QUEEN:
			return 'Q'
		case PIECETYPE_KING:
			return 'K'
		default: // << Pawns don't get a char. :'-(
			return ''
	}
}

// Annotate check (+), and checkmate (#)
function _checksAndMates(results: MoveResults): string {
	return !results.enemyInCheck ? '' : results.enemyCanMove ? '+' : '#'
	// if (!results.enemyCanMove) {
	//   // End of game has happened. Either checkmate or stalemate:
	//   return results.enemyInCheck
	//     ? "# " + (spaceGetColor(move.what) === COLOR_WHITE ? "1-0" : "0-1")
	//     : " ½-½";
	// }
	// return results.enemyInCheck ? "+" : "";
}
