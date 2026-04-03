<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children } = $props();
</script>

<GeneralTabs />

<main class="pb-18 md:min-h-screen md:pl-72">
	{@render children()}
</main>
