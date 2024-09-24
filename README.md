# Chess Game Playing Logic

**Features:**

-  Read And write FEN
-  Full support of Chess Rules:
   -  Move making
   -  Legal move and drop move generation
   -  Game end and outcome
   -  Insufficient material
   -  Setup validation
-  Support Chess 960
-  Read and write SAN
-  Read and write PGN
-  Saving game history

## Usage Example:

`
import { ChessGame, attackMapDebug } from 'chess'

const game = ChessGame.NewGame()
const board = game.getBoard()

game.move('e4')
game.move('e5')
game.move('Nf3')
game.move('Nf6')
game.move('Bc4')
game.move('Bc5')
game.move('Nc3')
game.move('Nc6')
game.move('0-0')
game.move('0-0')

console.log(attackMapDebug(board))
`
