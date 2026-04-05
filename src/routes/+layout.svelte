<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://res.cloudinary.com" />
	<link rel="preconnect" href="https://res.cloudinary.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://images.unsplash.com" />
	<link rel="preconnect" href="https://images.unsplash.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Madimi+One&display=swap" rel="stylesheet" />
</svelte:head>
{@render children()}
