/* ============================= */
/*   ⚙️ SET HELPERS              */
/* ============================= */

import type { Player, ScorePair } from './tennis.types'

// ✅ Pure helper: returns updated set score tuple.
export const updateSetWithGameWinner = ([p1, p2]: ScorePair, winner: Player): ScorePair =>
	winner === 'Player1' ? [p1 + 1, p2] : [p1, p2 + 1]

// Determines if someone has won the set.
export const setWinner = ([p1, p2]: ScorePair): Player | undefined => {
	if (p1 >= 6 && p1 - p2 >= 2) return 'Player1'
	if (p2 >= 6 && p2 - p1 >= 2) return 'Player2'
	if (p1 === 7 && p2 === 6) return 'Player1'
	if (p2 === 7 && p1 === 6) return 'Player2'
	return undefined
}

/* ============================= */
/*   ⚙️ MATCH HELPERS            */
/* ============================= */

// Determines if someone has won the match (best of 3 sets).
export const didPlayerWinMatch = (sets: ScorePair[]): Player | undefined => {
	const results = sets.map(setWinner)
	const p1SetWins = results.filter(r => r === 'Player1').length
	const p2SetWins = results.filter(r => r === 'Player2').length
	return p1SetWins >= 2 ? 'Player1' : p2SetWins >= 2 ? 'Player2' : undefined
}
