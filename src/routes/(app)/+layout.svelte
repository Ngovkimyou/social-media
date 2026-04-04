<script lang="ts">
	import GeneralTabs from '$lib/components/GeneralTabs.svelte';
	const { children, data } = $props();
</script>

<GeneralTabs profile_username={data['profile_username']} />

<main class="md:min-h-screen md:pl-72">
	{@render children()}
</main>
