// This module models a complete tennis scoring system (best of 3 sets, including tiebreaks).

import { z } from 'zod'
import { match, identity } from 'canary-js'

/* ============================= */
/*   🎾 TYPES & ENUMS             */
/* ============================= */

// Represents the possible points before deuce in a game
const PreDeucePoint = z.enum(['LOVE', 'FIFTEEN', 'THIRTY', 'FORTY'])
type PreDeucePoint = z.infer<typeof PreDeucePoint>

// Represents the two players in the match
const Player = z.enum(['Player1', 'Player2'])
export type Player = z.infer<typeof Player>

const NonNegativeInt = z.number().int().nonnegative()

/* ============================= */
/*   🎾 SCHEMAS                  */
/* ============================= */

// Represents the state of a single game in the match
const GameState = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('Normal'),
		player1Point: PreDeucePoint,
		player2Point: PreDeucePoint,
	}),
	z.object({
		kind: z.literal('Deuce'),
	}),
	z.object({
		kind: z.literal('Advantage'),
		playerAtAdvantage: Player,
	}),
	z.object({
		kind: z.literal('GameOver'),
		gameWinner: Player,
	}),
	z.object({
		kind: z.literal('Tiebreak'),
		p1Points: NonNegativeInt,
		p2Points: NonNegativeInt,
	}),
])
type GameState = z.infer<typeof GameState>

// Represents the overall state of the match including sets, current game, and winner if any
const MatchState = z.object({
	sets: z.tuple([
		z.tuple([NonNegativeInt, NonNegativeInt]),
		z.tuple([NonNegativeInt, NonNegativeInt]),
		z.tuple([NonNegativeInt, NonNegativeInt]),
	]),
	tiebreaks: z.tuple([
		z.tuple([NonNegativeInt, NonNegativeInt]).nullable(),
		z.tuple([NonNegativeInt, NonNegativeInt]).nullable(),
		z.tuple([NonNegativeInt, NonNegativeInt]).nullable(),
	]),
	currentGame: GameState,
	currentSet: z.number().int().min(1).max(3),
	matchWinner: Player.optional(),
})
type MatchState = z.infer<typeof MatchState>

/* ============================= */
/*   🎾 CORE SCORING FUNCTIONS    */
/* ============================= */

// Map to increment points for non-deuce game states
const nextPoint: Record<PreDeucePoint, PreDeucePoint> = {
	LOVE: 'FIFTEEN',
	FIFTEEN: 'THIRTY',
	THIRTY: 'FORTY',
	FORTY: 'FORTY', // stays at 40 in Normal state, handled separately
}

// Helper type to describe a game's outcome when a point is scored
type GameWinnerOrContinue = 'Player1Wins' | 'Player2Wins' | 'ContinueGame'

/**
 * Main orchestrator for scoring a point.
 * - Updates the current game's state (Normal, Deuce, Advantage, Tiebreak).
 * - If the game finishes, it updates the set.
 * - If a set finishes, it updates the match.
 */
export const scorePoint = (state: MatchState, pointWinner: Player): MatchState => {
	if (state.matchWinner !== undefined) {
		return state
	}

	// Decides if this point wins the game or if play continues (Pre-Deuce only).
	const choosePointOutcome = (
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

	// Moves Normal game to next point or to Deuce if both reach FORTY.
	const advanceNormalGame = (
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

	// 🎯 Evaluate the current game's next state based on pointWinner.
	const newGameState: GameState = match<GameState, GameState>(state.currentGame, {
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
		// In Deuce, the point winner gains Advantage
		Deuce: () => {
			return { kind: 'Advantage', playerAtAdvantage: pointWinner }
		},
		// In Advantage, if the player with advantage wins the point, they win the game; otherwise back to Deuce
		Advantage: ({ playerAtAdvantage }) =>
			playerAtAdvantage === pointWinner
				? { kind: 'GameOver', gameWinner: pointWinner }
				: { kind: 'Deuce' },
		// If game is over, state remains unchanged here
		GameOver: identity,
		// Tiebreak scoring
		Tiebreak: ({ p1Points, p2Points }) => {
			const [p1, p2] = [
				p1Points + (pointWinner === 'Player1' ? 1 : 0),
				p2Points + (pointWinner === 'Player2' ? 1 : 0),
			]

			const isWin = (p1 >= 7 || p2 >= 7) && Math.abs(p1 - p2) >= 2
			return isWin
				? { kind: 'GameOver', gameWinner: p1 > p2 ? 'Player1' : 'Player2' }
				: { kind: 'Tiebreak', p1Points: p1, p2Points: p2 }
		},
	})

	// ✅ If the game is over, update set and possibly tiebreak or move to next game.
	if (newGameState.kind === 'GameOver') {
		const updatedMatch = updateSetAfterGame(state, newGameState.gameWinner)
		const setIndex = state.currentSet - 1
		if (state.currentGame.kind === 'Tiebreak') {
			const finalTiebreakScore: [number, number] = [
				state.currentGame.p1Points + (newGameState.gameWinner === 'Player1' ? 1 : 0),
				state.currentGame.p2Points + (newGameState.gameWinner === 'Player2' ? 1 : 0),
			]
			return {
				...updatedMatch,
				tiebreaks: updatedMatch.tiebreaks.map((tb, i) =>
					i === setIndex ? finalTiebreakScore : tb
				) as MatchState['tiebreaks'],
				currentGame: startGame(),
			}
		} else {
			const currentSetGames = updatedMatch.sets[setIndex]
			if (currentSetGames[0] === 6 && currentSetGames[1] === 6) {
				return {
					...updatedMatch,
					currentGame: { kind: 'Tiebreak', p1Points: 0, p2Points: 0 },
				}
			}
			return {
				...updatedMatch,
				currentGame: startGame(),
			}
		}
	}

	// Otherwise, update the current game state and return
	return {
		...state,
		currentGame: newGameState,
	}
}

/** Start a new standard game at LOVE-LOVE */
export const startGame = (): GameState => {
	return GameState.parse({
		kind: 'Normal',
		player1Point: 'LOVE',
		player2Point: 'LOVE',
	})
}

/**
 * Updates set scores after a game, and progresses to next set or match if needed.
 */
export const updateSetAfterGame = (
	match: MatchState,
	winner: Player
): MatchState => {
	const setIndex = match.currentSet - 1

	// 🧩 Purely update the sets immutably
	const updatedSets = match.sets.map((set, i) =>
		i === setIndex ? updateSetWithGameWinner(set, winner) : set
	) as MatchState['sets']

	const thisSet = updatedSets[setIndex]
	const maybeSetWinner = setWinner(thisSet)
	const maybeMatchWinner = didPlayerWinMatch(updatedSets)

	// 🎯 Determine the next set only if a set winner exists and match isn't finished
	const nextSet =
		maybeSetWinner && !maybeMatchWinner && match.currentSet < 3
			? match.currentSet + 1
			: match.currentSet

	// 🧠 Return the new match state immutably
	return {
		...match,
		sets: updatedSets,
		currentSet: nextSet,
		matchWinner: maybeMatchWinner,
	}
}

/** Creates a fresh match with empty sets and a fresh game. */
export const startMatch = (): MatchState => {
	return {
		sets: [
			[0, 0],
			[0, 0],
			[0, 0],
		],
		tiebreaks: [null, null, null],
		currentGame: startGame(),
		currentSet: 1,
	}
}

/* ============================= */
/*   ⚙️ SET HELPERS              */
/* ============================= */

// ✅ Pure helper: returns updated set score tuple.
const updateSetWithGameWinner = (
	[p1, p2]: [number, number],
	winner: Player
): [number, number] => (winner === 'Player1' ? [p1 + 1, p2] : [p1, p2 + 1])

// Determines if someone has won the set.
const setWinner = ([p1, p2]: [number, number]): Player | undefined =>
  match<{ kind: string }, Player | undefined>(
    { kind: p1 >= 6 || p2 >= 6 ? 'Eligible' : 'Undecided' },
    {
      Eligible: () =>
        (p1 >= 6 && p1 - p2 >= 2) || (p1 === 7 && p2 === 6)
          ? 'Player1'
          : (p2 >= 6 && p2 - p1 >= 2) || (p2 === 7 && p1 === 6)
          ? 'Player2'
          : undefined,
      Undecided: () => undefined,
    }
  )

/* ============================= */
/*   ⚙️ MATCH HELPERS            */
/* ============================= */

// Determines if someone has won the match (best of 3 sets).
const didPlayerWinMatch = (sets: [number, number][]): Player | undefined =>
  match<{ kind: string }, Player | undefined>(
    { kind: sets.map(setWinner).join('-') },
    {
      // Player1 wins if two or more sets belong to Player1
      _: () => {
        const results = sets.map(setWinner)
        const [p1, p2] = [
          results.filter(r => r === 'Player1').length,
          results.filter(r => r === 'Player2').length,
        ]
        return p1 >= 2 ? 'Player1' : p2 >= 2 ? 'Player2' : undefined
      },
    }
  )

/* ============================= */
/*   🎾 ELM-STYLE UPDATE         */
/* ============================= */

// Elm-style message type delivering UI intents.
export const Msg = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PointScored'), player: Player }),
  z.object({ kind: z.literal('NewGame') }),
  z.object({ kind: z.literal('NewMatch') }),
])
export type Msg = z.infer<typeof Msg>

// Elm-style update: consumes a Msg and returns the next state.
export const update = (state: MatchState, msg: Msg): MatchState =>
  match<Msg, MatchState>(msg, {
    PointScored: ({ player }) => scorePoint(state, player),
    NewGame: () => ({ ...state, currentGame: startGame() }),
    NewMatch: () => startMatch(),
  })
