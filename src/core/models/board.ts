import { assert } from '../logic/assert'
import { attackMapAddPiece, attackMapRemovePiece } from '../logic/attack-map'
import { CastleMap } from './castle-map'
import { COLOR_BLACK, COLOR_WHITE, Color } from './color'
import { Coord } from './coord'
import { GAMESTATUS_ACTIVE, GameStatus } from './game-status'
import { Move } from './move'
import { SPACE_EMPTY, Space, spaceGetColor, spaceGetType } from './space'

// Uses the 0x88 strategy:
const BOARD_SIZE = 8 * 8 * 2

type Layer = {
	board: Uint8Array
	attacks: Uint8Array
	clock: number
	moveNum: number
	ep: Coord
	status: GameStatus
	turn: Color
	seen: { [hash: string]: number }
	castles: CastleMap
	moveCache: { [colors in Color]: Move[] | null }
	pieceList: Coord[]
}

export type PriorState = {
	clock: number
	moveNum: number
	ep: Coord
	status: GameStatus
	castles: CastleMap
}

export class Board {
	#layerIdx = 0
	#layers: Layer[] = [newLayer()]

	current: Layer = this.#layers[0]
	getLayers() {
		return this.#layers
	}
	reset() {
		this.#layerIdx = 0
		const current = (this.current = this.#layers[0])
		current.board.fill(SPACE_EMPTY)
		current.attacks.fill(0)
		current.clock = 0
		current.moveNum = 0
		current.ep = 0x88
		current.status = GAMESTATUS_ACTIVE
		current.turn = COLOR_WHITE
		current.seen = {}
		current.castles = 0
		current.moveCache[COLOR_WHITE] = null
		current.moveCache[COLOR_BLACK] = null
		current.pieceList = []
	}

	set(idx: Coord, space: Space) {
		assert((idx & 0x88) === 0, 'Invalid set() coord')

		const prior = this.current.board[idx]
		if (prior !== SPACE_EMPTY) {
			const color = spaceGetColor(prior)
			const type = spaceGetType(prior)
			attackMapRemovePiece(this, idx, color, type)
		}

		this.current.board[idx] = space

		if (space !== SPACE_EMPTY) {
			const color = spaceGetColor(space)
			const type = spaceGetType(space)
			attackMapAddPiece(this, idx, color, type)
		}

		// Update the piece list:
		if ((prior === SPACE_EMPTY) !== (space === SPACE_EMPTY)) {
			const list = this.current.pieceList
			if (prior === SPACE_EMPTY) {
				// Piece added:
				list.push(idx)
			} else {
				// Piece removed:
				const pieceIdx = list.indexOf(idx)
				const last = list.length - 1
				if (pieceIdx !== last) {
					const temp = list[last]
					list[last] = idx
					list[pieceIdx] = temp
				}
				list.pop()
			}
		}
	}

	get(idx: Coord): Space {
		assert((idx & 0x88) === 0, 'Invalid get() coord')
		return this.current.board[idx]
	}

	putBoardHash(hash: string): number {
		// When getting the prior number, run backwards through history until we find this hash. We don't duplicate the hash
		// histories the same way as other Layer data, because duplicating those objects is slow, and we need to change
		// layers frequently. (Far more frequently than they're used...)
		for (let idx = this.#layerIdx; idx >= 0; idx--) {
			if (hash in this.#layers[idx].seen) {
				// Oh! this one! Add 1, copy forward, and return.
				const num = 1 + this.#layers[idx].seen[hash]
				this.current.seen[hash] = num
				return num
			}
		}

		// Else, not found:
		this.current.seen[hash] = 1
		return 1
	}

	removeBoardHash(hash: string): void {
		// When getting the prior number, run backwards through history until we find this hash. We don't duplicate the hash
		// histories the same way as other Layer data, because duplicating those objects is slow, and we need to change
		// layers frequently. (Far more frequently than they're used...)
		for (let idx = this.#layerIdx; idx >= 0; idx--) {
			if (hash in this.#layers[idx].seen) {
				// Oh! this one! Decrement 1 and return.
				this.current.seen[hash]--
				return
			}
		}
	}

	save() {
		const idx = ++this.#layerIdx
		if (idx === this.#layers.length) {
			this.#layers.push(newLayer())
		}
		this.current = this.#layers[idx]
		copyLayer(this.#layers[idx - 1], this.current)
	}

	restore() {
		if (this.#layerIdx > 0) {
			const idx = --this.#layerIdx
			this.current = this.#layers[idx]
		}
	}

	getPriorState(): PriorState {
		const current = this.current
		return {
			clock: current.clock,
			moveNum: current.moveNum,
			ep: current.ep,
			status: current.status,
			castles: current.castles,
		}
	}
}

function newLayer(): Layer {
	return {
		board: new Uint8Array(BOARD_SIZE).fill(SPACE_EMPTY),
		attacks: new Uint8Array(BOARD_SIZE * 2).fill(0),
		clock: 0,
		moveNum: 1,
		ep: 0x88,
		status: GAMESTATUS_ACTIVE,
		turn: COLOR_WHITE,
		seen: {},
		castles: 0,
		moveCache: {
			[COLOR_WHITE]: null,
			[COLOR_BLACK]: null,
		},
		pieceList: [],
	}
}

function copyLayer(src: Layer, dest: Layer) {
	dest.board.set(src.board)
	dest.attacks.set(src.attacks)
	dest.clock = src.clock
	dest.moveNum = src.moveNum
	dest.ep = src.ep
	dest.status = src.status
	dest.turn = src.turn
	dest.seen = {} // Just create new object instead of copying massive objects.
	dest.castles = src.castles
	dest.moveCache[COLOR_WHITE] = src.moveCache[COLOR_WHITE]
	dest.moveCache[COLOR_BLACK] = src.moveCache[COLOR_BLACK]
	dest.pieceList = src.pieceList.slice()
}
