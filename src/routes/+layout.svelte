<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Madimi+One&display=swap" rel="stylesheet" />
</svelte:head>
{@render children()}
