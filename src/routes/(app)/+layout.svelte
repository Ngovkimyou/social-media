<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children } = $props();
</script>

<GeneralTabs />

<main class="pb-18 md:min-h-screen md:pt-6 md:pr-6 md:pb-0 md:pl-72">
	{@render children()}
</main>

<style>
	:global(:root) {
		--color-background: #09051c;
		--color-surface-container: #0d062d;
		--color-primary: #d294ff;
		--color-on-surface: #ffffff;
		--color-on-surface-variant: #aea8c0;

		--font-family-headline: 'Plus Jakarta Sans', sans-serif;
		--font-family-body: 'Plus Jakarta Sans', sans-serif;
	}

	:global(body) {
		background-color: var(--color-background);
		color: var(--color-on-surface);
		font-family: var(--font-family-body);
		overflow-x: hidden;
	}

	:global(.material-symbols-outlined) {
		font-variation-settings:
			'FILL' 0,
			'wght' 400,
			'GRAD' 0,
			'opsz' 24;
	}
</style>
