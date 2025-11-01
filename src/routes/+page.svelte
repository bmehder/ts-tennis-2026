<script lang="ts">
	import { startMatch, update } from '$lib/tennis'
	import { type MatchState, type Player } from '$lib/tennis.types'

	let matchState = $state(startMatch())

	const handlePoint = (_: MouseEvent, player: Player) => {
		matchState = update(matchState, { kind: 'PointScored', player })
	}

	const resetMatch = () => {
		matchState = update(matchState, { kind: 'NewMatch' })
	}

	const pointMap = {
		LOVE: 0,
		FIFTEEN: 15,
		THIRTY: 30,
		FORTY: 40,
	} as const

	const getDisplayPoints = (
		game: MatchState['currentGame'],
		player: Player
	): number | string => {
		if (game.kind === 'Normal') {
			return player === 'Player1'
				? pointMap[game.player1Point]
				: pointMap[game.player2Point]
		}

		if (game.kind === 'Deuce') return 40

		if (game.kind === 'Advantage')
			return game.playerAtAdvantage === player ? 'AD' : 40

		if (game.kind === 'Tiebreak')
			return player === 'Player1' ? game.p1Points : game.p2Points

		return ''
	}

	const getSetDisplay = (match: MatchState, setIndex: number, player: Player) => {
		const games = match.sets[setIndex]
		const tb = match.tiebreaks[setIndex]

		// Get basic games score (0 or 1 index depending on player)
		const gameScore = player === 'Player1' ? games[0] : games[1]

		// If no tiebreak, just return the game score
		if (!tb) return gameScore

		// Tiebreak exists → show like "7 (5)" if player lost 7–5 tiebreak
		const tbScore = player === 'Player1' ? tb[0] : tb[1]
		return `${gameScore} (${tbScore})`
	}
</script>

<div class="scoreboard">
	<!-- Header Row -->
	<div class="cell heading">Player</div>
	<div class="cell heading">Set 1</div>
	<div class="cell heading">Set 2</div>
	<div class="cell heading">Set 3</div>
	<div class="cell heading">Points</div>

	<!-- Player 1 Row -->
	<div class="cell player">Player 1</div>
	<div class="cell">{getSetDisplay(matchState, 0, 'Player1')}</div>
	<div class="cell">{getSetDisplay(matchState, 1, 'Player1')}</div>
	<div class="cell">{getSetDisplay(matchState, 2, 'Player1')}</div>
	<div class="cell">{getDisplayPoints(matchState.currentGame, 'Player1')}</div>

	<!-- Player 2 Row -->
	<div class="cell player">Player 2</div>
		<div class="cell">{getSetDisplay(matchState, 0, 'Player2')}</div>
	<div class="cell">{getSetDisplay(matchState, 1, 'Player2')}</div>
	<div class="cell">{getSetDisplay(matchState, 2, 'Player2')}</div>
	<div class="cell">{getDisplayPoints(matchState.currentGame, 'Player2')}</div>
</div>

<div class="controls text-align-center flow">
	{#if matchState}
		<div>
			<button onclick={evt => handlePoint(evt, 'Player1')}>Player 1</button>
			<button onclick={evt => handlePoint(evt, 'Player2')}>Player 2</button>
			{#if matchState.matchWinner}
				<button onclick={resetMatch}>New Match</button>
			{/if}
		</div>
	{/if}
</div>

<details>
	<summary>MatchState Object</summary>
	<pre>{JSON.stringify(matchState, null, 2)}</pre>
</details>

<style>
	.scoreboard {
		display: grid;
		grid-template-columns: 1.5fr repeat(3, 1fr) 1fr; /* Player column wider */
		gap: var(--size-0-2-5);
		align-items: center;
		max-width: var(--sm);
		margin-block: var(--size);
		margin-inline: auto;
		background: #f9f9f9;
		text-align: center;
		border: 1px solid #ccc;
		border-radius: var(--size-0-5);
		padding: var(--size-0-5);
	}

	.scoreboard > div {
		padding: var(--size-0-5);
		border-bottom: 1px solid #e0e0e0;
	}

	/* heading row styling */
	.heading {
		font-weight: bold;
	}

	/* First column (Player names) */
	.player {
		text-align: left;
		font-weight: bold;
	}

	/* Remove bottom border on last row */
	.scoreboard .cell:nth-last-child(-n + 5) {
		border-bottom: none;
	}
</style>
