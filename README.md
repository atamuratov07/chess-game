# Chess Game Logic

A chess rules engine in TypeScript with no dependencies. It knows which moves are legal in any position, detects how a game ends, and reads and writes the standard chess notations.

## Features

- Legal move generation, including castling, en passant and promotion
- Moves given in SAN (`Nf3`) or UCI (`g1f3`), and undo
- Game end detection: checkmate, stalemate, threefold repetition, the fifty-move rule and insufficient material
- Resigning and agreed draws
- Reading and writing FEN positions and PGN games, including PGN tags
- Move history and printing the board as text

## Usage

```ts
import { ChessGame } from './src'

const game = ChessGame.NewGame()

game.move('e4').move('e5').move('Nf3').move('Nc6').move('Bc4').move('Nf6')
game.move('Ng5').move('d5').move('exd5').move('Nxd5')

console.log(game.getStatus())          // { state: 'active', turn: 'white' }
console.log(game.toString('fen'))      // r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6
console.log(game.toString('ascii'))    // the board as text

const fromPgn = ChessGame.NewFromPGN('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0')
console.log(fromPgn.getStatus())       // { state: 'checkmate', turn: 'black', winner: 'white' }
```
