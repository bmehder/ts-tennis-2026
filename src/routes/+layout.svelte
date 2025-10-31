<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/css/reboot.css'
	import '$lib/css/utilities.css'

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="wrapper">
	<header></header>
	<main>
		<div class="outer">
			<div class="inner">
				<div class="content flow">
					{@render children()}
				</div>
			</div>
		</div>
	</main>
	<footer></footer>
</div>
