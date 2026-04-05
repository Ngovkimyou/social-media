<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<svelte:head>
	<link rel="dns-prefetch" href="https://res.cloudinary.com" />
	<link rel="preconnect" href="https://res.cloudinary.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://images.unsplash.com" />
	<link rel="preconnect" href="https://images.unsplash.com" crossorigin="anonymous" />
</svelte:head>
{@render children()}
