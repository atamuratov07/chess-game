import { ChessError } from '../models/chess-error'

export function assert(expr: unknown, msg: string): void {
	if (!expr) {
		throw new ChessError(msg)
	}
}
