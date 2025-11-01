<script lang="ts">
	import { match } from 'canary-js'
	import { startMatch, update } from '$lib/tennis'
	import { type MatchState, type Player, type ScorePair } from '$lib/tennis.types'

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
	): string =>
		match(game, {
			Normal: g =>
				String(
					player === 'Player1' ? pointMap[g.player1Point] : pointMap[g.player2Point]
				),
			Deuce: () => '40',
			Advantage: g => (g.playerAtAdvantage === player ? 'AD' : '40'),
			Tiebreak: g => String(player === 'Player1' ? g.p1Points : g.p2Points),
		})

	const isSetOver = ([p1, p2]: ScorePair): boolean =>
		((p1 >= 6 || p2 >= 6) && Math.abs(p1 - p2) >= 2) || p1 === 7 || p2 === 7

	const getSetDisplay = (match: MatchState, setIndex: number, player: Player) => {
		const games = match.sets[setIndex]
		const tb = match.tiebreaks[setIndex]
		const gameScore = player === 'Player1' ? games[0] : games[1]

		const winner = games[0] > games[1] ? 'Player1' : 'Player2'

		const finished = isSetOver(games)

		// No tiebreak → just return the game score
		if (!tb)
			return finished && winner === player
				? `<strong>${gameScore}</strong>`
				: String(gameScore)

		// Tiebreak → include TB score like 7 <sup>5</sup>
		const tbScore = player === 'Player1' ? tb[0] : tb[1]
		return finished && winner === player
			? `<strong>${gameScore} <sup>${tbScore}</sup></strong>`
			: `${gameScore} <sup>${tbScore}</sup>`
	}
</script>

<h1>TS TEA-nnis 2026 (w/ Zod)</h1>	

<div class="scoreboard">
	<!-- Header Row -->
	<div class="heading">Player</div>
	<div class="heading">Set 1</div>
	<div class="heading">Set 2</div>
	<div class="heading">Set 3</div>
	<div class="heading">Points</div>

	<!-- Player 1 Row -->
	<div class="player">Player 1</div>
	<div>{@html getSetDisplay(matchState, 0, 'Player1')}</div>
	<div>{@html getSetDisplay(matchState, 1, 'Player1')}</div>
	<div>{@html getSetDisplay(matchState, 2, 'Player1')}</div>
	<div>{getDisplayPoints(matchState.currentGame, 'Player1')}</div>

	<!-- Player 2 Row -->
	<div class="player">Player 2</div>
	<div>{@html getSetDisplay(matchState, 0, 'Player2')}</div>
	<div>{@html getSetDisplay(matchState, 1, 'Player2')}</div>
	<div>{@html getSetDisplay(matchState, 2, 'Player2')}</div>
	<div>{getDisplayPoints(matchState.currentGame, 'Player2')}</div>
</div>

<div class="controls text-align-center flow">
	{#if matchState?.matchWinner}
		<button onclick={resetMatch}>New Match</button>
	{:else}
		<button
			disabled={!!matchState.matchWinner}
			onclick={evt => handlePoint(evt, 'Player1')}>Player 1</button
		>
		<button
			disabled={!!matchState.matchWinner}
			onclick={evt => handlePoint(evt, 'Player2')}>Player 2</button
		>
	{/if}
</div>

<div class="text-align-center"><a href="https://github.com/bmehder/ts-tennis-2026" target="_blank">GitHub Repo</a></div>

<style>
	h1 {
		margin-block: var(--size-2-5);
		text-align: center;
	}

	.scoreboard {
		display: grid;
		grid-template-columns: 1.5fr repeat(3, 1fr) 1fr; /* Player column wider */
		gap: var(--size-0-2-5);
		align-items: center;
		max-width: var(--sm);
		margin-block: var(--size);
		margin-inline: auto;
		background: #f9f9f9;
		color: initial;
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
	.scoreboard > div:nth-last-child(-n + 5) {
		border-bottom: none;
	}
</style>
