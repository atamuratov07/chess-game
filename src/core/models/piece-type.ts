export type PieceType = number
export const PIECETYPE_PAWN = 1
export const PIECETYPE_BISHOP = 2
export const PIECETYPE_KNIGHT = 3
export const PIECETYPE_ROOK = 4
export const PIECETYPE_QUEEN = 5
export const PIECETYPE_KING = 6

const PIECETYPE_SYMBOLS: { [type in PieceType]: string } = {
	[PIECETYPE_PAWN]: 'P',
	[PIECETYPE_BISHOP]: 'B',
	[PIECETYPE_KNIGHT]: 'N',
	[PIECETYPE_ROOK]: 'R',
	[PIECETYPE_QUEEN]: 'Q',
	[PIECETYPE_KING]: 'K',
}

export function pieceTypeSymbol(type: PieceType): string {
	return PIECETYPE_SYMBOLS[type]
}
