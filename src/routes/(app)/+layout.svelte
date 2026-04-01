<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children } = $props();
</script>

<GeneralTabs />

<main class="pb-18 md:min-h-screen md:pt-6 md:pr-6 md:pb-0 md:pl-72">
	{@render children()}
</main>
