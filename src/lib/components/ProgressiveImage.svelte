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
		on_load?: (() => void) | undefined;
		on_error?: (() => void) | undefined;
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
		skeleton_class = '',
		on_load,
		on_error
	}: Props = $props();

	let isloaded_state = $state(false);
	let did_notify_load = $state(false);
	let previous_src = '';
	let image_element = $state<HTMLImageElement | undefined>();

	$effect(() => {
		if (src !== previous_src) {
			previous_src = src;
			isloaded_state = false;
			did_notify_load = false;
		}
	});

	function mark_loaded() {
		isloaded_state = true;
		if (did_notify_load) return;
		did_notify_load = true;
		on_load?.();
	}

	function mark_errored() {
		isloaded_state = true;
		if (did_notify_load) return;
		did_notify_load = true;
		on_error?.();
	}

	$effect(() => {
		void tick().then(() => {
			if (image_element?.complete) {
				if (image_element.naturalWidth > 0) {
					mark_loaded();
				} else {
					mark_errored();
				}
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
			mark_loaded();
		}}
		onerror={() => {
			mark_errored();
		}}
		draggable="false"
		class={`${img_class} transition-opacity duration-300 ${isloaded_state ? 'opacity-100' : 'opacity-0'}`}
	/>
</div>
