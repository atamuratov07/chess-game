import { assert } from '../logic/assert'

// AN - Arithmetic Number
const AN_RE = /^[a-h][1-8]$/i
const FILES = 'abcdefgh'
const RANKS = '12345678'

export type Coord = number

export const parseCoord = (idx: Coord): [file: number, rank: number] => [
	idx & 0x7,
	idx >>> 4,
]

export const buildCoord = (file: number, rank: number): number =>
	((rank & 0x7) << 4) | (file & 0x7)

export const coordFromAN = (an: string): Coord => {
	assert(AN_RE.test(an), 'Invalid coord')
	const lower = an.toLowerCase()
	const file = lower.charCodeAt(0) - 97
	const rank = lower.charCodeAt(1) - 49
	return buildCoord(file, rank)
}

export const coordToAN = (idx: Coord): string => {
	const [file, rank] = parseCoord(idx)
	return FILES[file] + RANKS[rank]
}
