<script lang="ts">
	import { tick } from 'svelte';

	type FetchPriority = 'high' | 'low' | 'auto';

	type Props = {
		src: string;
		alt: string;
		srcset?: string | undefined;
		sizes?: string | undefined;
		loading?: 'lazy' | 'eager';
		decoding?: 'async' | 'auto' | 'sync';
		fetchpriority?: FetchPriority;
		wrapper_class?: string | undefined;
		img_class?: string | undefined;
		skeleton_class?: string | undefined;
	};

	const {
		src,
		alt,
		srcset,
		sizes,
		loading = 'lazy',
		decoding = 'async',
		fetchpriority = 'auto',
		wrapper_class = '',
		img_class = '',
		skeleton_class = ''
	}: Props = $props();

	let isloaded_state = $state(false);
	let previous_src = '';
	let image_element = $state<HTMLImageElement | undefined>();

	$effect(() => {
		if (src !== previous_src) {
			previous_src = src;
			isloaded_state = false;
		}
	});

	$effect(() => {
		void tick().then(() => {
			if (image_element?.complete) {
				isloaded_state = true;
			}
		});
	});
</script>

<div class={`relative overflow-hidden ${wrapper_class}`}>
	{#if !isloaded_state}
		<div class={`skeleton-shimmer absolute inset-0 ${skeleton_class}`} aria-hidden="true"></div>
	{/if}

	<img
		bind:this={image_element}
		{src}
		{alt}
		{srcset}
		{sizes}
		{loading}
		{decoding}
		{fetchpriority}
		onload={() => {
			isloaded_state = true;
		}}
		onerror={() => {
			isloaded_state = true;
		}}
		class={`${img_class} transition-opacity duration-300 ${isloaded_state ? 'opacity-100' : 'opacity-0'}`}
	/>
</div>
