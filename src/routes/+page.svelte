<script lang="ts">
	import { startMatch, update, type Player } from '$lib/tennis'

	let matchState = $state(startMatch())

	const handlePoint = (_: MouseEvent, player: Player) => {
		matchState = update(matchState, { kind: 'PointScored', player })
	}

	const resetMatch = () => {
		matchState = update(matchState, { kind: 'NewMatch' })
	}
</script>

{#if matchState}
	<button onclick={evt => handlePoint(evt, 'Player1')}>Player 1</button>
	<button onclick={evt => handlePoint(evt, 'Player2')}>Player 2</button>
	<button onclick={resetMatch}>New Match</button>
	<pre>{JSON.stringify(matchState, null, 2)}</pre>
{/if}
