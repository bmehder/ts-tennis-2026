import { identity, match } from 'canary-js'
import {
	nextPoint,
	type GameState,
	type GameWinnerOrContinue,
	type MatchState,
	type Player,
	type PreDeucePoint,
	type ScorePair,
} from './tennis.types'
import { startGame } from './tennis'

/* ============================= */
/*   🎾 GAME HELPERS            */
/* ============================= */

/**
 * Determines if the point ends the game or play continues (pre-deuce only).
 */
export const choosePointOutcome = (
	player1Point: PreDeucePoint,
	player2Point: PreDeucePoint,
	pointWinner: Player
): GameWinnerOrContinue =>
	match<{ kind: Player }, GameWinnerOrContinue>(
		{ kind: pointWinner },
		{
			Player1: () =>
				player1Point === 'FORTY' && player2Point !== 'FORTY'
					? 'Player1Wins'
					: 'ContinueGame',
			Player2: () =>
				player2Point === 'FORTY' && player1Point !== 'FORTY'
					? 'Player2Wins'
					: 'ContinueGame',
		}
	)

/**
 * Advances a Normal game — either to the next score or Deuce.
 */
export const advanceNormalGame = (
	player1Point: PreDeucePoint,
	player2Point: PreDeucePoint,
	pointWinner: Player
): GameState =>
	match<{ kind: Player }, GameState>(
		{ kind: pointWinner },
		{
			Player1: () =>
				nextPoint[player1Point] === 'FORTY' && player2Point === 'FORTY'
					? { kind: 'Deuce' }
					: {
							kind: 'Normal',
							player1Point: nextPoint[player1Point],
							player2Point,
					  },
			Player2: () =>
				nextPoint[player2Point] === 'FORTY' && player1Point === 'FORTY'
					? { kind: 'Deuce' }
					: {
							kind: 'Normal',
							player1Point,
							player2Point: nextPoint[player2Point],
					  },
		}
	)

/**
 * Core game state transition after every point scored.
 */
export const updateGameState = (game: GameState, pointWinner: Player): GameState =>
	match(game, {
		Normal: ({ player1Point, player2Point }) =>
			match(
				{ kind: choosePointOutcome(player1Point, player2Point, pointWinner) },
				{
					Player1Wins: () => ({ kind: 'GameOver', gameWinner: 'Player1' }),
					Player2Wins: () => ({ kind: 'GameOver', gameWinner: 'Player2' }),
					ContinueGame: () =>
						advanceNormalGame(player1Point, player2Point, pointWinner),
				}
			),

		Deuce: () => ({ kind: 'Advantage', playerAtAdvantage: pointWinner }),

		Advantage: ({ playerAtAdvantage }) =>
			playerAtAdvantage === pointWinner
				? { kind: 'GameOver', gameWinner: pointWinner }
				: { kind: 'Deuce' },

		Tiebreak: ({ p1Points, p2Points }) => {
			const p1 = p1Points + (pointWinner === 'Player1' ? 1 : 0)
			const p2 = p2Points + (pointWinner === 'Player2' ? 1 : 0)
			const isWin = (p1 >= 7 || p2 >= 7) && Math.abs(p1 - p2) >= 2
			return isWin
				? { kind: 'GameOver', gameWinner: p1 > p2 ? 'Player1' : 'Player2' }
				: { kind: 'Tiebreak', p1Points: p1, p2Points: p2 }
		},

		GameOver: identity,
	})

/**
 * Adds a game win to the current set score.
 */
export const updateSetWithGameWinner = (
	[p1, p2]: ScorePair,
	winner: Player
): ScorePair => (winner === 'Player1' ? [p1 + 1, p2] : [p1, p2 + 1])

/**
 * Determines if a set has been won.
 */
export const setWinner = ([p1, p2]: ScorePair): Player | undefined => {
	if (p1 >= 6 && p1 - p2 >= 2) return 'Player1'
	if (p2 >= 6 && p2 - p1 >= 2) return 'Player2'
	if (p1 === 7 && p2 === 6) return 'Player1'
	if (p2 === 7 && p1 === 6) return 'Player2'
	return undefined
}

/* ============================= */
/*   🏆 MATCH HELPERS            */
/* ============================= */

/**
 * Returns the match winner (best of 3 sets), or undefined if still in progress.
 */
export const didPlayerWinMatch = (sets: ScorePair[]): Player | undefined => {
	const results = sets.map(setWinner)
	const p1SetWins = results.filter(r => r === 'Player1').length
	const p2SetWins = results.filter(r => r === 'Player2').length
	return p1SetWins >= 2 ? 'Player1' : p2SetWins >= 2 ? 'Player2' : undefined
}


/**
 * Finalizes a tiebreak game by updating the current set's tiebreak score and starting a new game.
 *
 * This function should be called when a tiebreak game has been won. It updates the tiebreak score
 * for the current set with the final point, resets the current game to a new game, and returns
 * the updated match state. If the current game is not a tiebreak, the match state is returned unchanged.
 *
 * @param match - The current match state.
 * @param gameWinner - The player who won the tiebreak game.
 * @param setIndex - The index of the set to update the tiebreak score for.
 * @returns The updated match state with the finalized tiebreak score and a new game started.
 */
export const finalizeTiebreak = (
  match: MatchState,
  gameWinner: Player,
  setIndex: number
): MatchState => {
  const tb = match.currentGame

  if (tb.kind !== 'Tiebreak') return match

  const finalScore: ScorePair = [
    tb.p1Points + (gameWinner === 'Player1' ? 1 : 0),
    tb.p2Points + (gameWinner === 'Player2' ? 1 : 0),
  ]

  return {
    ...match,
    tiebreaks: match.tiebreaks.map((t, i) =>
      i === setIndex ? finalScore : t
    ) as MatchState['tiebreaks'],
    currentGame: startGame(),
  }
}