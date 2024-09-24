import { PriorState } from './board'
import { Coord } from './coord'
import { PieceType } from './piece-type'
import { Space } from './space'

export type Move = {
	// These exist for all move types:
	what: Space
	from: Coord
	to: Coord

	// These exist for captures. (Capture coord may differ from dest with en passant)
	capture: Space
	captureCoord: Coord

	// These exist for castles.
	castleRook: Space
	castleRookFrom: Coord
	castleRookTo: Coord

	// This exists when a pawn promotes to something:
	promote: PieceType | 0

	// Mark this space as being available for En Passants:
	// Aside, while 0 is a valid coord, it is never possible to get an En Passant there, so 0 is used as the "empty"
	// state.
	markEnPassant: Coord

	// Prior state. Used when unmaking a move:
	prior: PriorState
}

export function createSimpleMove(
	what: Space,
	from: Coord,
	to: Coord,
	prior: PriorState
): Move {
	return createFullMove(what, from, to, 0, 0, 0, 0, 0, 0, 0, prior)
}

export function createSimpleCapture(
	what: Space,
	from: Coord,
	to: Coord,
	capture: Space,
	captureCoord: Coord,
	prior: PriorState
): Move {
	return createFullMove(
		what,
		from,
		to,
		capture,
		captureCoord,
		0,
		0,
		0,
		0,
		0,
		prior
	)
}

export function createCastle(
	what: Space,
	from: Coord,
	to: Coord,
	castleRook: Space,
	castleRookFrom: Coord,
	castleRookTo: Coord,
	prior: PriorState
): Move {
	return createFullMove(
		what,
		from,
		to,
		0,
		0,
		castleRook,
		castleRookFrom,
		castleRookTo,
		0,
		0,
		prior
	)
}

export function createFullMove(
	what: Space,
	from: Coord,
	to: Coord,
	capture: Space,
	captureCoord: Coord,
	castleRook: Space,
	castleRookFrom: Coord,
	castleRookTo: Coord,
	promote: PieceType,
	markEnPassant: Coord,
	prior: PriorState
) {
	return {
		what,
		from,
		to,
		capture,
		captureCoord,
		castleRook,
		castleRookFrom,
		castleRookTo,
		promote,
		markEnPassant,
		prior,
	}
}

export function moveToPromotion(move: Move, promote: PieceType): Move {
	return { ...move, promote }
}
