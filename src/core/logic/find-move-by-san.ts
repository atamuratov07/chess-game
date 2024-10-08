import { ChessBadMove, ChessNeedsPromotion } from '../models/chess-error'
import { coordFromAN } from '../models/coord'
import { Move } from '../models/move'
import {
	PIECETYPE_BISHOP,
	PIECETYPE_KING,
	PIECETYPE_KNIGHT,
	PIECETYPE_PAWN,
	PIECETYPE_QUEEN,
	PIECETYPE_ROOK,
	PieceType,
} from '../models/piece-type'
import { spaceGetType } from '../models/space'

const PIECETYPE_MAP: { [type: string]: PieceType } = {
	'': PIECETYPE_PAWN,
	B: PIECETYPE_BISHOP,
	N: PIECETYPE_KNIGHT,
	R: PIECETYPE_ROOK,
	Q: PIECETYPE_QUEEN,
	K: PIECETYPE_KING,
}

const CASTLE_RE =
	/^(O-O(?:-O)?|0-0(?:-0)?)(?:\s+|[!?]+|[+#]|[eE]\.?[pP]\.?|(?:1|0|1\/2|½)-(?:1|0|1\/2|½))*$/
const MOVE_RE =
	/^([BNRQK]?)([a-h]?)([1-8]?)(x?)([a-h][1-8])(?:=([BNRQ]))?(?:\s+|[!?]+|[+#]|[eE]\.?[pP]\.?|(?:1|0|1\/2|½)-(?:1|0|1\/2|½))*$/
// [1] - Piece capture
// [2] - Departure file
// [3] - Departure rank
// [4] - Is capture?
// [5] - Destination
// [6] - Promotion?
// [x] - Ignored extra stuff

/**
 * Locate a move by its standard algebraic notation representation.
 *
 * Will throw an error if the SAN doesn't select exactly 1 move. (So be specific with the departure if there is that
 * level of ambiguity...)
 *
 * Details:
 * - Ignores most annotations, like +, #, 1-0, e.p., ??, etc...
 * - Castles can use either O's (uppercase leger) or 0's (digit zero), but must be consistent.
 *
 * @param moves
 * @param san
 */
export function findMoveBySAN(moves: Move[], san: string): Move {
	san = san.trim()

	// Castles:
	const castleMatch = san.match(CASTLE_RE)
	if (castleMatch) {
		return _selectMoveByInvariant(
			moves,
			san,
			castleMatch[1].length === 5
				? move => (move.castleRookTo & 0x7) === 3 // O-O-O
				: move => (move.castleRookTo & 0x7) === 5 // O-O
		)
	}

	const match = san.match(MOVE_RE)
	if (!match) {
		throw new ChessBadMove(`Couldn't parse: ${san}`)
	}

	const move = _selectMoveByInvariant(
		moves,
		san,
		move =>
			// Check the destination + piece types first, since they're always present, and can fully identify the move
			// in the majority of cases:
			coordFromAN(match[5]) === move.to &&
			spaceGetType(move.what) === PIECETYPE_MAP[match[1]] &&
			// Narrow things further by the departure parts + capture:
			(match[2]
				? (move.from & 0x7) === match[2].charCodeAt(0) - 97
				: true) &&
			(match[3]
				? ((move.from >>> 4) & 0x7) === match[3].charCodeAt(0) - 49
				: true) &&
			(match[4] ? move.capture !== 0 : move.capture === 0) &&
			(match[6] ? move.promote === PIECETYPE_MAP[match[6]] : true)
	)

	return move
}

function _selectMoveByInvariant(
	moves: Move[],
	san: string,
	fn: (m: Move) => boolean
): Move {
	let found: Move | null = null

	for (let i = 0; i < moves.length; i++) {
		const move = moves[i]
		if (fn(move)) {
			if (found) {
				// Special case: Forgetting the promotion param:
				if (found.promote && move.promote) {
					throw new ChessNeedsPromotion()
				}
				throw new ChessBadMove(`${san} is ambiguous`)
			}
			found = move
		}
	}

	if (found) {
		return found
	}

	throw new ChessBadMove(`${san} is not a valid move`)
}
