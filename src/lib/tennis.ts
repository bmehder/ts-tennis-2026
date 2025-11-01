// This module implements a complete tennis scoring system for a best-of-3 sets match, including tiebreaks.
// It manages game states, set scores, and determines match winners.

import { match } from 'canary-js'
import {
	updateSetWithGameWinner,
	didPlayerWinMatch,
	setWinner,
	updateGameState,
	finalizeTiebreak,
} from './tennis.utils'

import {
  type Player,
	type MatchState,
	type GameState,
	GameState as GameStateSchema,
	Msg,
} from './tennis.types'

/** Initializes a new match with empty sets, no tiebreaks, and a fresh game at set 1. */
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

/** Creates a new standard game starting at LOVE-LOVE (0-0 points). */
export const startGame = (): GameState => {
	return GameStateSchema.parse({
		kind: 'Normal',
		player1Point: 'LOVE',
		player2Point: 'LOVE',
	})
}

/**
 * Handles scoring a point for the specified player.
 * Updates the current game's state, and if the game finishes,
 * updates the set and potentially the match state.
 */
// 🎾 2. Delegate to utils to update the current game state (Normal, Deuce, Advantage, or Tiebreak)
export const scorePoint = (state: MatchState, pointWinner: Player): MatchState => {
	// 🛑 1. Match already has a winner → ignore inputs
	if (state.matchWinner) return state

	// 🎾 2. Delegate to utils to update the current game state (Normal, Deuce, Advantage, or Tiebreak)
	const newGameState = updateGameState(state.currentGame, pointWinner)

	// ✅ 3. If the game isn’t over, just return updated game state
	if (newGameState.kind !== 'GameOver') {
		return { ...state, currentGame: newGameState }
	}

	// 🏁 4. Game is over → update set score
	const updatedMatch = updateSetAfterGame(state, newGameState.gameWinner)
	const setIndex = updatedMatch.currentSet - 1

	// 👇 5. If this was a tiebreak game, finalize the tiebreak for the set
	if (state.currentGame.kind === 'Tiebreak') {
		const finishedSetIndex = state.currentSet - 1
		return finalizeTiebreak(updatedMatch, newGameState.gameWinner, finishedSetIndex)
	}

	// If this is a non-final-set 6–6 situation, start a tiebreak
	const [p1Games, p2Games] = updatedMatch.sets[setIndex]
	if (p1Games === 6 && p2Games === 6) {
		return {
			...updatedMatch,
			currentGame: { kind: 'Tiebreak', p1Points: 0, p2Points: 0 },
		}
	}

	// 🔄 7. Otherwise → move to a fresh game
	return { ...updatedMatch, currentGame: startGame() }
}

/**
 * Updates the set scores after a game finishes.
 * Advances to the next set or declares a match winner if conditions are met.
 * (Tiebreak finalization is handled separately in scorePoint)
 */
export const updateSetAfterGame = (
	match: MatchState,
	gameWinner: Player
): MatchState => {
	const index = match.currentSet - 1

	const updatedSets = match.sets.map((set, i) =>
		i === index ? updateSetWithGameWinner(set, gameWinner) : set
	) as MatchState['sets']

	const setWinner_ = setWinner(updatedSets[index])
	const matchWinner_ = didPlayerWinMatch(updatedSets)

	// If the match has a winner, update state accordingly
	if (matchWinner_) {
		return { ...match, sets: updatedSets, matchWinner: matchWinner_ }
	}

	// If the set ended but the match continues, advance to next set if applicable
	const nextSet =
		setWinner_ && match.currentSet < 3 ? match.currentSet + 1 : match.currentSet

	return {
		...match,
		sets: updatedSets,
		currentSet: nextSet,
	}
}

/* ============================= */
/*   🎾 ELM-STYLE UPDATE         */
/* ============================= */

/**
 * Elm-style update function that takes a message and returns the updated match state.
 */
export const update = (state: MatchState, msg: Msg): MatchState =>
	match<Msg, MatchState>(msg, {
		PointScored: ({ player }) => scorePoint(state, player),
		NewGame: () => ({ ...state, currentGame: startGame() }),
		NewMatch: () => startMatch(),
	})
