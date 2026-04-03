<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children } = $props();
</script>

<GeneralTabs />

<main class="md:min-h-screen md:pl-72">
	{@render children()}
</main>
