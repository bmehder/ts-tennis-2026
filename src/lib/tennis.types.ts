import { z } from 'zod'

/* ============================= */
/*   🎾 TYPES & ENUMS             */
/* ============================= */

// Represents the possible points before deuce in a game
const PreDeucePoint = z.enum(['LOVE', 'FIFTEEN', 'THIRTY', 'FORTY'])
export type PreDeucePoint = z.infer<typeof PreDeucePoint>

// Represents the two players in the match
export const PlayerSchema = z.enum(['Player1', 'Player2'])
export type Player = z.infer<typeof PlayerSchema>

const NonNegativeInt = z.number().int().nonnegative()

// ✅ A reusable tuple type for scores like [6, 4] or [7, 6]
const ScorePair = z.tuple([NonNegativeInt, NonNegativeInt])
export type ScorePair = z.infer<typeof ScorePair>

/* ============================= */
/*   🎾 SCHEMAS                  */
/* ============================= */

// Represents the state of a single game in the match
export const GameState = z.discriminatedUnion('kind', [
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
		playerAtAdvantage: PlayerSchema,
	}),
	z.object({
		kind: z.literal('Tiebreak'),
		p1Points: NonNegativeInt,
		p2Points: NonNegativeInt,
	}),
	z.object({
		kind: z.literal('GameOver'),
		gameWinner: PlayerSchema,
	}),
])
export type GameState = z.infer<typeof GameState>

// Represents the overall state of the match including sets, current game, and winner if any
const MatchState = z.object({
	sets: z.tuple([ScorePair, ScorePair, ScorePair]),
	tiebreaks: z.tuple([
		ScorePair.nullable(),
		ScorePair.nullable(),
		ScorePair.nullable(),
	]),
	currentGame: GameState,
	currentSet: z.number().int().min(1).max(3),
	matchWinner: PlayerSchema.optional(),
})
export type MatchState = z.infer<typeof MatchState>

/* ============================= */
/*   🎾 CORE SCORING FUNCTIONS    */
/* ============================= */

// Map to increment points for non-deuce game states
export const nextPoint: Record<PreDeucePoint, PreDeucePoint> = {
	LOVE: 'FIFTEEN',
	FIFTEEN: 'THIRTY',
	THIRTY: 'FORTY',
	FORTY: 'FORTY', // stays at 40 in Normal state, handled separately
}

// Helper type to describe a game's outcome when a point is scored
export type GameWinnerOrContinue = 'Player1Wins' | 'Player2Wins' | 'ContinueGame'

// Elm-style message type delivering UI intents.
export const Msg = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('PointScored'),
		player: z.enum(['Player1', 'Player2']),
	}),
	z.object({ kind: z.literal('NewGame') }),
	z.object({ kind: z.literal('NewMatch') }),
])
export type Msg = z.infer<typeof Msg>