import { Board } from '../../models/board'
import { ChessParseError } from '../../models/chess-error'
import { Color } from '../../models/color'
import {
	GAMESTATUS_ACTIVE,
	GAMESTATUS_DRAW,
	GAMESTATUS_DRAW_STALEMATE,
	GAMESTATUS_RESIGNED,
} from '../../models/game-status'
import { Move } from '../../models/move'
import { buildStandardBoard } from '../board-layouts/build-standar-board'
import { boardFromFEN } from '../fen/board-from-fen'
import { findMoveBySAN } from '../find-move-by-san'
import { listAllValidMoves } from '../list-valid-moves'
import { checkMoveResults } from '../move-results'
import { performMove } from '../perform-move'
import { validatePGNKeyValue } from './pgn-utils'

/**
 * PGN file parsing can be customized with a few options.
 */
export interface PgnParseOpts {
	verifyTags: boolean
}

// Output from the Lexer: (Defined by PGN spec, section 7)
// Note: < > omitted as they don't have meaning yet
// Todo: Commentary ("{ text }" and "; text \n") is currently treated the same as full comments (%...). At some point,
//       support bringing in the commentary...
type Token =
	| TokenSpecialChar
	| TokenString
	| TokenInteger
	| TokenSymbol
	| TokenNag
type TokenSpecialChar = { type: '[' | ']' | '(' | ')' | '.' | '*' }
type TokenString = { type: 'Str'; value: string }
type TokenInteger = { type: 'Int'; value: number }
type TokenSymbol = { type: 'Sym'; value: string }
type TokenNag = { type: 'Nag'; value: number }

export type PgnOutput = {
	board: Board
	moves: PgnMove[]
	tags: { [key: string]: string }
	winner: 'white' | 'black' | 'draw' | null
}

export type PgnMove = {
	num: number
	turn: Color
	move: Move
	san: string
}

type Tags = { [key: string]: string }

const GAME_TERM_RE = /^(1-0|0-1|1\/2-1\/2)$/

/**
 * Parses a PGN string, and returns the details necessary to fully bootstrap a ChessGame based on it.
 */
export function gameFromPGN(pgn: string): PgnOutput {
	const tokens = _lexer(pgn)
	const tags: Tags = {}
	const moves: PgnMove[] = []

	// Consume all PGN tags.
	while (tokens[0]?.type === '[') {
		_parseTag(tokens, tags)
	}

	// Now that we have the tags. Init the board to either the optional FEN starting pos, or just the standard setup:
	const board =
		tags.SetUp === '1' && tags.FEN
			? boardFromFEN(tags.FEN)
			: buildStandardBoard()

	// Consume all moves. Moves *MUST* be valid:
	_parseMoveList(tokens, board, moves)

	// Last token describes the game status:
	const ending = _parseEndOfGame(tokens, board)

	if (tags.Result && ending !== tags.Result) {
		throw new ChessParseError('PGN Result tag has an incorrect game status')
	}

	// Done. Return all the things:
	return { board, tags, moves, winner: _winnerString(ending) }
}

function _parseTag(tokens: Token[], tags: Tags) {
	const lbrack = tokens.shift() as TokenSpecialChar
	_expectToken(lbrack, '[')

	const key = tokens.shift() as TokenSymbol
	_expectToken(key, 'Sym')

	const val = tokens.shift() as TokenString
	_expectToken(val, 'Str')

	const rbrack = tokens.shift() as TokenSpecialChar
	_expectToken(rbrack, ']')

	validatePGNKeyValue(key.value, val.value)

	if (tags[key.value]) {
		throw new ChessParseError('Duplicate PGN tag: ' + key.value)
	}

	tags[key.value] = val.value
}

function _parseMoveList(tokens: Token[], board: Board, moves: PgnMove[]) {
	while (true) {
		const tok = tokens.shift()
		if (!tok) {
			throw new ChessParseError(`PGN move list didn't have a conclusion`)
		}
		// Ints are move number asserts:
		if (tok.type === 'Int') {
			if (board.current.moveNum !== tok.value) {
				throw new ChessParseError(
					`PGN move list expected it to be turn ${tok.value}, but the board is on ${board.current.moveNum}'`
				)
			}
			continue
		}

		// Dots are ignored:
		if (tok.type === '.') {
			continue
		}

		// Ignore NAGs for now:
		if (tok.type === 'Nag') {
			continue
		}

		// * is a game termination marker:
		if (tok.type === '*') {
			tokens.unshift(tok)
			break
		}

		// Hypothetical movesets aren't supported, so skip them:
		if (tok.type === '(') {
			let stackDepth = 1
			while (stackDepth) {
				const tok = tokens.shift()
				if (!tok) {
					throw new ChessParseError(
						`PGN move list didn't have a conclusion`
					)
				}
				if (tok.type === '(') {
					stackDepth++
				} else if (tok.type === ')') {
					stackDepth--
				}
			}
			continue
		}

		// Symbols are either win / loss / draw notifications, or SAN moves:
		if (tok.type === 'Sym') {
			// Game termination markers indicate the end of the move list:
			if (GAME_TERM_RE.test(tok.value)) {
				tokens.unshift(tok)
				break
			}

			// Else, possibly a move.
			_doMove(board, moves, tok.value)
			continue
		}

		// Else, unexpected symbol:
		throw new ChessParseError(
			`PGN data had unexpected data in the move list: ${_describeToken(tok)}`
		)
	}
}

function _parseEndOfGame(tokens: Token[], board: Board): string {
	const end = tokens.shift()
	if (!end) {
		throw new ChessParseError(`PGN move list didn't have a conclusion`)
	}
	if (tokens.length) {
		throw new ChessParseError(`PGN had extra moves after game ended`)
	}

	if (end.type === '*') {
		// Game should still be active:
		return '*'
	}

	_expectToken(end, 'Sym')

	const sym = end as TokenSymbol
	switch (sym.value) {
		// Either white or black won. Either way, the board status should be in checkmate. If it's active, then
		// we'll call it a resignation:
		case '1-0':
		case '0-1':
			if (board.current.status === GAMESTATUS_ACTIVE) {
				board.current.status = GAMESTATUS_RESIGNED
			}
			return sym.value

		// Draw. Pull a good reason from the move result object, and move on:

		case '1/2-1/2': {
			const res = checkMoveResults(board, 8 - board.current.turn)
			board.current.status =
				res.newGameStatus >= GAMESTATUS_DRAW
					? res.newGameStatus
					: GAMESTATUS_DRAW
			return sym.value
		}

		default:
			throw new ChessParseError(
				`PGN had an unexpected game end: ${sym.value}`
			)
	}
}

// Do the given move. However, we're a WEE bit more permissive about draw conditions, because people in a game could
// have elected to not stop:
function _doMove(board: Board, moves: PgnMove[], san: string) {
	const turn = board.current.turn
	const allMoves = listAllValidMoves(board, turn)
	const move = findMoveBySAN(allMoves, san)
	moves.push({
		num: board.current.moveNum,
		turn: board.current.turn,
		move,
		san,
	})
	performMove(board, move)
	const res = checkMoveResults(board, turn)
	board.current.turn = 8 - turn
	// We'll accept active, checkmated, or stalemated status, but not the others. (Yet)
	if (
		res.newGameStatus < GAMESTATUS_DRAW ||
		res.newGameStatus === GAMESTATUS_DRAW_STALEMATE
	) {
		board.current.status = res.newGameStatus
	}
}

function _winnerString(status: string): 'white' | 'black' | 'draw' | null {
	switch (status) {
		case '1-0':
			return 'white'
		case '0-1':
			return 'black'
		case '1/2-1/2':
			return 'draw'
		default:
			return null
	}
}

const LEX_SANITIZE_RE = /(?:^|\n)%[^\n]*/g
const LEX_WHITESPACE_RE = /^\s+/
const LEX_COMMENTARY_RE = /^(?:;[^\n]*\n|\{[^}]*\})/
const LEX_SINGLE_CHAR_RE = /^[\[\]().*]/
const LEX_STRING_RE = /^"(?:[^\\"]|\\.)*"/ // TODO: Len + non-ascii
const LEX_SYMBOL_RE = /^([a-z0-9][-a-z0-9_+#=:/]*)[!?]{0,2}/i
const LEX_NAG_RE = /^\$\d+/
const LEX_INT_RE = /^\d+$/

const LEX_STR_ESCAPE_RE = /\\(.)/g
const LEX_STR_BAD_CHARS_RE = /[^\x20-\x7e]/

// Note: exported only for unit tests:
export function _lexer(pgn: string): Token[] {
	let wip = pgn.replace(LEX_SANITIZE_RE, '') + '\n'
	const out: Token[] = []

	while (wip) {
		let match

		// Ignore this stuff:
		match = wip.match(LEX_WHITESPACE_RE) || wip.match(LEX_COMMENTARY_RE)
		if (match) {
			wip = wip.slice(match[0].length)
			continue
		}

		// Standalone single-char tokens:
		match = wip.match(LEX_SINGLE_CHAR_RE)
		if (match) {
			const char = match[0]
			out.push({ type: char } as TokenSpecialChar)
			wip = wip.slice(char.length)
			continue
		}

		// Symbol. Could be Int or Sym:
		match = wip.match(LEX_SYMBOL_RE)
		if (match) {
			const raw = match[0]
			const value = match[1]
			if (LEX_INT_RE.test(value)) {
				out.push({ type: 'Int', value: parseInt(value, 10) })
			} else {
				out.push({ type: 'Sym', value })
			}
			wip = wip.slice(raw.length)
			continue
		}

		// Quoted string:
		match = wip.match(LEX_STRING_RE)
		if (match) {
			const raw = match[0]
			out.push({ type: 'Str', value: _handleString(raw) })
			wip = wip.slice(raw.length)
			continue
		}

		// NAG code:
		match = wip.match(LEX_NAG_RE)
		if (match) {
			const raw = match[0]
			out.push({ type: 'Nag', value: parseInt(raw.slice(1), 10) })
			wip = wip.slice(raw.length)
			continue
		}

		// Else, nothing good matches:
		if (wip.startsWith('"')) {
			throw new ChessParseError('PGN string reached the end')
		}

		// Else, unknown character:
		throw new ChessParseError(`PGN had unexpected data: ${wip.slice(0, 10)}`)
	}

	return out
}

function _handleString(raw: string): string {
	const out = raw.slice(1, -1).replace(LEX_STR_ESCAPE_RE, (full, ch) => {
		if (ch !== '\\' && ch !== '"') {
			throw new ChessParseError(
				`Invalid PGN string escape: ${JSON.stringify(full)}`
			)
		}
		return ch
	})
	if (LEX_STR_BAD_CHARS_RE.test(out)) {
		throw new ChessParseError(
			'PGN strings can only contain printable ASCII characters'
		)
	}
	if (out.length >= 256) {
		throw new ChessParseError('PGN strings must be 255 chars or less')
	}
	return out
}

function _expectToken(tok: Token | undefined, shouldBe: Token['type']) {
	if (!tok || tok.type !== shouldBe) {
		new ChessParseError(
			`Expected a '${shouldBe}' token, but got ${_describeToken(tok)}.`
		)
	}
}

function _describeToken(tok: Token | undefined): string {
	if (!tok) return 'the end-of-file'
	switch (tok.type) {
		case '[':
		case ']':
		case '(':
		case ')':
		case '.':
		case '*':
			return `a '${tok.type}`
		case 'Int':
			return `the Integer '${tok.value}'`
		case 'Str':
			return `the String '${tok.value}'`
		case 'Sym':
			return `the Symbol '${tok.value}'`
		case 'Nag':
			return `the NAG Code $${tok.value}`
		default:
			return `the unknown symbol: ${JSON.stringify(tok)}`
	}
}
