import { buildStandardBoard } from '../core/logic/board-layouts/build-standar-board'
import { boardRenderASCII } from '../core/logic/board-render-ascii'
import { boardFromFEN } from '../core/logic/fen/board-from-fen'
import { boardToFEN } from '../core/logic/fen/board-to-fen'
import { listAllValidMoves, listValidMoves } from '../core/logic/list-valid-moves'
import { gameFromPGN } from '../core/logic/pgn/game-from-pgn'
import { gameToPGN } from '../core/logic/pgn/game-to-pgn'
import { validatePGNKeyValue } from '../core/logic/pgn/pgn-utils'
import { revertMove } from '../core/logic/revert-move'
import { Board } from '../core/models/board'
import { ChessBadInput, ChessGameOver } from '../core/models/chess-error'
import { COLOR_WHITE } from '../core/models/color'
import { coordFromAN, coordToAN } from '../core/models/coord'
import {
	GAMESTATUS_ACTIVE,
	GAMESTATUS_CHECKMATE,
	GAMESTATUS_DRAW,
	GAMESTATUS_DRAW_FIFTYMOVES,
	GAMESTATUS_DRAW_NOMATERIAL,
	GAMESTATUS_DRAW_REPETITION,
	GAMESTATUS_DRAW_STALEMATE,
	GAMESTATUS_RESIGNED,
	GameStatus,
} from '../core/models/game-status'
import { pieceTypeSymbol } from '../core/models/piece-type'
import { SPACE_EMPTY, spaceGetColor, spaceGetType } from '../core/models/space'
import { doGameMove } from './do-game-move'
import { GameMove, GameMoveInternal } from './game-move'

export interface Status {
	state:
		| 'active'
		| 'checkmate'
		| 'resigned'
		| 'draw-other'
		| 'draw-stalemate'
		| 'draw-repetition'
		| 'draw-fifty-moves'
		| 'draw-no-material'

	turn: 'white' | 'black'

	winner?: 'white' | 'black' | 'draw'

	reason?: string
}

interface MoveDetails {
	from: string

	to: string

	promotion?: 'B' | 'N' | 'R' | 'Q'
}

interface SpaceDetails {
	coord: string

	piece?: {
		color: 'white' | 'black'

		pieceType: 'P' | 'B' | 'N' | 'R' | 'Q' | 'K'
	}
}

interface PGNOptions {
	tags?: { [name: string]: string }
}

// Map used to convert internal status into external ones:
const GAMESTATUS_MAP: { [status in GameStatus]: Status['state'] } = {
	[GAMESTATUS_ACTIVE]: 'active',
	[GAMESTATUS_CHECKMATE]: 'checkmate',
	[GAMESTATUS_RESIGNED]: 'resigned',
	[GAMESTATUS_DRAW]: 'draw-other',
	[GAMESTATUS_DRAW_STALEMATE]: 'draw-stalemate',
	[GAMESTATUS_DRAW_REPETITION]: 'draw-repetition',
	[GAMESTATUS_DRAW_FIFTYMOVES]: 'draw-fifty-moves',
	[GAMESTATUS_DRAW_NOMATERIAL]: 'draw-no-material',
}

export class ChessGame {
	#board: Board
	#moves: GameMoveInternal[] = []

	#gameWinner: 'white' | 'black' | 'draw' | null = null
	#drawReason: string | null = null

	#tags: { [name: string]: string } = {}

	getBoard() {
		return this.#board
	}
	private constructor(b: Board) {
		this.#board = b
		this.setTag('Date', new Date())
	}

	public static NewGame(): ChessGame {
		return new ChessGame(buildStandardBoard())
	}

	public static NewFromFEN(fen: string): ChessGame {
		const game = new ChessGame(boardFromFEN(fen))
		game.maybeRefreshWinner()
		game.setTag('SetUp', true)
		game.setTag('FEN', fen)
		return game
	}

	public static NewFromPGN(pgn: string): ChessGame {
		const data = gameFromPGN(pgn)
		const game = new ChessGame(data.board)
		game.#tags = data.tags
		game.#moves.push(
			...data.moves.map((move): GameMoveInternal => {
				return {
					num: move.num,
					side: move.turn === COLOR_WHITE ? 'white' : 'black',
					from: coordToAN(move.move.from),
					to: coordToAN(move.move.to),
					san: move.san,
					move: move.move,
				}
			})
		)
		if (data.winner) {
			game.#gameWinner = data.winner
		}
		return game
	}

	getSpace(coord: string): SpaceDetails {
		const idx = coordFromAN(coord)
		const sp = this.#board.get(idx)
		const details: SpaceDetails = { coord }
		if (sp !== SPACE_EMPTY) {
			details.piece = {
				color: spaceGetColor(sp) === COLOR_WHITE ? 'white' : 'black',
				pieceType: pieceTypeSymbol(spaceGetType(sp)) as
					| 'P'
					| 'B'
					| 'N'
					| 'R'
					| 'Q'
					| 'K',
			}
		}
		return details
	}

	getTags(): { [name: string]: string } {
		return { ...this.#tags }
	}

	setTag(name: string, value: null | string | boolean | number | Date) {
		// Special case for key deletion:
		if (value == null) {
			validatePGNKeyValue(name, '')
			delete this.#tags[name]
			return
		}

		// Else, coerce to string:
		let valueStr: string
		if (typeof value === 'boolean') {
			valueStr = value ? '1' : '0'
		} else if (value instanceof Date) {
			valueStr = isNaN(value.valueOf())
				? '????.??.??'
				: [
						value.getFullYear(),
						String(value.getMonth() + 1).padStart(2, '0'),
						String(value.getDate()).padStart(2, '0'),
				  ].join('.')
		} else {
			valueStr = String(value)
		}

		validatePGNKeyValue(name, valueStr)
		this.#tags[name] = valueStr
	}

	history(): GameMove[] {
		// Duplicate the structs, so client-side fiddling doesn't muck things up:
		return this.#moves.map(move => ({
			num: move.num,
			side: move.side,
			from: move.from,
			to: move.to,
			san: move.san,
		}))
	}

	getStatus(): Status {
		const current = this.#board.current
		const out: Status = {
			state: GAMESTATUS_MAP[current.status],
			turn: current.turn === COLOR_WHITE ? 'white' : 'black',
		}
		if (this.#gameWinner) {
			out.winner = this.#gameWinner
		}
		if (this.#drawReason) {
			out.reason = this.#drawReason
		}
		return out
	}

	isGameOver(): boolean {
		return Boolean(this.#board.current.status)
	}

	public move(move: string | MoveDetails): ChessGame {
		if (this.isGameOver()) {
			throw new ChessGameOver()
		}

		// This method handles both UCI and SAN:
		const record = doGameMove(this.#board, move)
		this.#moves.push(record)

		// Did the move checkmate or draw the game? If so, update the winner accordingly:
		this.maybeRefreshWinner()

		return this
	}

	public undoMove(): ChessGame {
		const move = this.#moves.pop()

		if (move) {
			revertMove(this.#board, move.move)
			this.#gameWinner = null
		}

		return this
	}

	allMoves(coord?: string): MoveDetails[] {
		if (this.isGameOver()) {
			return []
		}

		const turn = this.#board.current.turn
		let moves

		if (coord == null) {
			moves = listAllValidMoves(this.#board, turn)
		} else {
			const idx = coordFromAN(coord)
			const sp = this.#board.get(idx)
			if (sp === SPACE_EMPTY || spaceGetColor(sp) !== turn) {
				return []
			}
			moves = listValidMoves(this.#board, idx)
		}
		return moves.map(move => {
			const from = coordToAN(move.from)
			const to = coordToAN(move.to)

			return move.promote
				? {
						from,
						to,
						promotion: pieceTypeSymbol(move.promote) as
							| 'B'
							| 'N'
							| 'R'
							| 'Q',
				  }
				: { from, to }
		})
	}

	resignGame(player: 'white' | 'black') {
		if (this.isGameOver()) {
			throw new ChessGameOver()
		}

		this.#board.current.status = GAMESTATUS_RESIGNED
		this.#gameWinner = player === 'white' ? 'black' : 'white'
	}

	drawGame(reason?: string) {
		if (this.isGameOver()) {
			throw new ChessGameOver()
		}
		this.#board.current.status = GAMESTATUS_DRAW
		if (reason) {
			this.#drawReason = reason
		}
	}

	toString(fmt: 'pgn' | 'ascii' | 'terminal' | 'fen' = 'ascii'): string {
		switch (fmt) {
			case 'ascii':
				return boardRenderASCII(this.#board, false)
			case 'terminal':
				return boardRenderASCII(this.#board, true)
			case 'fen':
				return boardToFEN(this.#board)
			case 'pgn': {
				return gameToPGN({
					board: this.#board,
					winner: this.#gameWinner,
					moves: this.#moves,
					tags: this.#tags,
				})
			}
			default:
				throw new ChessBadInput(fmt)
		}
	}

	private maybeRefreshWinner() {
		const status = this.#board.current.status
		const turn = this.#board.current.turn

		if (status === GAMESTATUS_CHECKMATE) {
			// Winner is the person who ISN'T currently checkmated:
			this.#gameWinner = turn === COLOR_WHITE ? 'black' : 'white'
		} else if (status >= GAMESTATUS_DRAW) {
			this.#gameWinner = 'draw'
		}
	}
}
