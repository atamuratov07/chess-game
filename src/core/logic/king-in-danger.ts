import { Board } from '../models/board'
import { Color } from '../models/color'
import { PIECETYPE_KING } from '../models/piece-type'
import { spaceGetColor, spaceGetType } from '../models/space'
import { attackMapIsAttacked } from './attack-map'

export function kingInDanger(b: Board, kingColor: Color): boolean {
	const enemy = 8 - kingColor
	for (const idx of b.current.pieceList) {
		const spot = b.get(idx)
		if (
			spaceGetType(spot) !== PIECETYPE_KING ||
			spaceGetColor(spot) !== kingColor
		) {
			continue
		}

		if (attackMapIsAttacked(b, idx, enemy)) {
			return true
		}
	}
	return false
}
