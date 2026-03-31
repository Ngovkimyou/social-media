<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children } = $props();
</script>

<GeneralTabs />

<main class="pb-18 md:pb-0">
	{@render children()}
</main>
