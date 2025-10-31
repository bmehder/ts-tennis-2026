// This module models a tennis scoring system (best of 3 sets, no tiebreaks yet).

import { z } from 'zod'
import { match, identity } from 'canary-js'

// Represents the possible points before deuce in a game
const PreDeucePoint = z.enum(['LOVE', 'FIFTEEN', 'THIRTY', 'FORTY'])
type PreDeucePoint = z.infer<typeof PreDeucePoint>

// Represents the two players in the match
const Player = z.enum(['Player1', 'Player2'])
export type Player = z.infer<typeof Player>

const NonNegativeInt = z.number().int().nonnegative()

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

const nextPoint: Record<PreDeucePoint, PreDeucePoint> = {
	LOVE: 'FIFTEEN',
	FIFTEEN: 'THIRTY',
	THIRTY: 'FORTY',
	FORTY: 'FORTY', // stays at 40 in Normal state, handled separately
}

type GameWinnerOrContinue = 'Player1Wins' | 'Player2Wins' | 'ContinueGame'

/**
 * Orchestrates scoring a point in the match.
 * Delegates to helpers to update game state, and advances game, set, or match as needed.
 */
export const scorePoint = (state: MatchState, pointWinner: Player): MatchState => {
	if (state.matchWinner !== undefined) {
		return state
	}

	// Determine if the point winner wins the game or if the game continues
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
					pointWinner === 'Player2' && player2Point === 'FORTY' && player1Point !== 'FORTY'
						? 'Player2Wins'
						: 'ContinueGame',
			}
		)

	// Update points in a normal game state and handle transition to Deuce if both reach FORTY
	const continueNormal = (
		player1Point: PreDeucePoint,
		player2Point: PreDeucePoint,
		pointWinner: Player
	): GameState => {
		const newP1 =
			pointWinner === 'Player1' ? nextPoint[player1Point] : player1Point
		const newP2 =
			pointWinner === 'Player2' ? nextPoint[player2Point] : player2Point
		return newP1 === 'FORTY' && newP2 === 'FORTY'
			? { kind: 'Deuce' }
			: { kind: 'Normal', player1Point: newP1, player2Point: newP2 }
	}

	const newGameState: GameState = match<GameState, GameState>(state.currentGame, {
		Normal: ({ player1Point, player2Point }) =>
			match(
				{ kind: choosePointOutcome(player1Point, player2Point, pointWinner) },
				{
					Player1Wins: () => ({ kind: 'GameOver', gameWinner: 'Player1' }),
					Player2Wins: () => ({ kind: 'GameOver', gameWinner: 'Player2' }),
					ContinueGame: () => continueNormal(player1Point, player2Point, pointWinner),
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
			const newP1Points = pointWinner === 'Player1' ? p1Points + 1 : p1Points
			const newP2Points = pointWinner === 'Player2' ? p2Points + 1 : p2Points
			if (
				(newP1Points >= 7 || newP2Points >= 7) &&
				Math.abs(newP1Points - newP2Points) >= 2
			) {
				const gameWinner = newP1Points > newP2Points ? 'Player1' : 'Player2'
				return { kind: 'GameOver', gameWinner }
			} else {
				return { kind: 'Tiebreak', p1Points: newP1Points, p2Points: newP2Points }
			}
		},
	})

	// If the game is over, update the match state with the game winner and start a new game
	if (newGameState.kind === 'GameOver') {
		const updatedMatch = scoreGame(state, newGameState.gameWinner)
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

/**
 * Initializes a new game with both players at LOVE
 */
export const startGame = (): GameState => {
	return GameState.parse({
		kind: 'Normal',
		player1Point: 'LOVE',
		player2Point: 'LOVE',
	})
}

// Small helper: determine if a player has won the set (accounts for tiebreak wins)
const didPlayerWinSet = (p1: number, p2: number, player: Player): boolean =>
  match<{ kind: Player }, boolean>(
    { kind: player },
    {
      Player1: () =>
        (p1 >= 6 && p1 - p2 >= 2) || (p1 === 7 && p2 === 6),
      Player2: () =>
        (p2 >= 6 && p2 - p1 >= 2) || (p2 === 7 && p1 === 6),
    }
  )

// New helper function to update set games with the game winner
const updateSetWithGameWinner = (
	[p1, p2]: [number, number],
	winner: Player
): [number, number] => (winner === 'Player1' ? [p1 + 1, p2] : [p1, p2 + 1])

// Helper function to determine if a player has won the match
const didPlayerWinMatch = (updatedSets: [number, number][]): Player | undefined => {
	const [p1SetsWon, p2SetsWon] = updatedSets.reduce<[number, number]>(
		([p1, p2], [p1Games, p2Games]) => [
			p1 + (didPlayerWinSet(p1Games, p2Games, 'Player1') ? 1 : 0),
			p2 + (didPlayerWinSet(p1Games, p2Games, 'Player2') ? 1 : 0),
		],
		[0, 0]
	)

	return p1SetsWon >= 2 ? 'Player1' : p2SetsWon >= 2 ? 'Player2' : undefined
}

/**
 * Updates the match state after a game ends by incrementing the set score,
 * advancing to the next set if needed, and determining if the match is won.
 */
export const scoreGame = (match: MatchState, winner: Player): MatchState => {
	const setIndex = match.currentSet - 1
	const currentSetGames = updateSetWithGameWinner(
		[...match.sets[setIndex]] as [number, number],
		winner
	)

	const updatedSets = match.sets.map((set, i) =>
		i === setIndex ? currentSetGames : set
	) as MatchState['sets']

	const [p1Games, p2Games] = currentSetGames
	const setIsOver =
		didPlayerWinSet(p1Games, p2Games, 'Player1') ||
		didPlayerWinSet(p1Games, p2Games, 'Player2')

	const nextSet =
		setIsOver && match.currentSet < 3
			? match.currentSet + 1
			: match.currentSet

	const matchWinner = didPlayerWinMatch(updatedSets)

	return {
		...match,
		sets: updatedSets,
		currentSet: nextSet,
		matchWinner,
	}
}

/**
 * Initializes a new match with three sets at 0-0,
 * the first game started, and current set set to 1.
 */
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

/**
 * Elm-style message type representing all possible user or system actions
 */
export const Msg = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PointScored'), player: Player }),
  z.object({ kind: z.literal('NewGame') }),
  z.object({ kind: z.literal('NewMatch') }),
])
export type Msg = z.infer<typeof Msg>

/**
 * Elm-style update function
 * Takes the current state and a message, and returns the next state.
 */
export const update = (state: MatchState, msg: Msg): MatchState =>
  match<Msg, MatchState>(msg, {
    PointScored: ({ player }) => scorePoint(state, player),
    NewGame: () => ({ ...state, currentGame: startGame() }),
    NewMatch: () => startMatch(),
  })
