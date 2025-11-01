// This module models a complete tennis scoring system (best of 3 sets, including tiebreaks).
import { z } from 'zod'
import { match, identity } from 'canary-js'
import {
	updateSetWithGameWinner,
	didPlayerWinMatch,
	setWinner,
} from './tennis.utils'

import {
  type Player,
	type MatchState,
	type PreDeucePoint,
	type GameWinnerOrContinue,
	type GameState,
	GameState as GameStateSchema,
	nextPoint,
	type ScorePair,
	Msg,
} from './tennis.types'

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
			const finalTiebreakScore: ScorePair = [
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
	return GameStateSchema.parse({
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
/*   🎾 ELM-STYLE UPDATE         */
/* ============================= */

// Elm-style update: consumes a Msg and returns the next state.
export const update = (state: MatchState, msg: Msg): MatchState =>
	match<Msg, MatchState>(msg, {
		PointScored: ({ player }) => scorePoint(state, player),
		NewGame: () => ({ ...state, currentGame: startGame() }),
		NewMatch: () => startMatch(),
	})

