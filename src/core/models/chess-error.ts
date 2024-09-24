export class ChessError extends Error {}

export class ChessGameOver extends ChessError {
	constructor() {
		super('Game is over')
	}
}

export class ChessBadInput extends ChessError {
	constructor(msg: string) {
		super(`Unexpected input: ${msg}`)
	}
}

export class ChessBadMove extends ChessError {
	constructor(msg: string) {
		super('Bad move: ' + msg)
	}
}

export class ChessNeedsPromotion extends ChessError {
	constructor() {
		super('Promotion piece is required for this move')
	}
}

export class ChessParseError extends ChessError {}
