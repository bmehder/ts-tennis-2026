<script lang="ts">
	import favicon from '$lib/assets/favicon.svg'
	import '$lib/css/reboot.css'
	import '$lib/css/utilities.css'

	let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main>
	<div class="outer">
		<div class="inner">
			<div class="content flow">
				{@render children()}
			</div>
		</div>
	</div>
</main>

<style>
	main .outer {
		min-height: 100dvh;
		background: linear-gradient(135deg, #1e3c72, #2a5298);
		color: white;
	}
</style>
