<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';

	const { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<main class="min-h-screen p-12">
	<div class="min-h-[calc(100vh-6rem)] rounded-[3rem] bg-(--color-surface-container)/50 p-12">
		{@render children()}
	</div>
</main>

<div style="display:none">
	{#each locales as locale (locale)}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>

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
