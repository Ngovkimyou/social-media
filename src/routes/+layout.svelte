<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';

	const { children } = $props();
	const nonselectable_asset_selector = 'img, video, canvas, svg, [data-nonselectable-asset="true"]';
	const nonselectable_ui_selector =
		'button, [role="button"], [role="tab"], [role="switch"], [data-nonselectable-ui="true"]';
	const nonselectable_empty_input_selector = '[data-nonselectable-empty-input="true"]';
	const selectable_text_selector = '[data-selectable-text="true"]';

	function is_nonselectable_asset(target: EventTarget | null) {
		return target instanceof Element && Boolean(target.closest(nonselectable_asset_selector));
	}

	function is_nonselectable_ui(target: EventTarget | null) {
		if (target instanceof Element && target.closest(selectable_text_selector)) {
			return false;
		}

		return (
			target instanceof Element &&
			Boolean(target.closest(`${nonselectable_asset_selector}, ${nonselectable_ui_selector}`))
		);
	}

	function is_nonselectable_empty_input(target: EventTarget | null) {
		if (!(target instanceof HTMLInputElement)) {
			return false;
		}

		return target.matches(nonselectable_empty_input_selector) && target.value.trim().length === 0;
	}

	function prevent_asset_drag(event: DragEvent) {
		if (is_nonselectable_asset(event.target)) {
			event.preventDefault();
		}
	}

	function prevent_asset_selection(event: Event) {
		if (is_nonselectable_ui(event.target) || is_nonselectable_empty_input(event.target)) {
			event.preventDefault();
		}
	}

	onMount(() => {
		document.addEventListener('dragstart', prevent_asset_drag, true);
		document.addEventListener('selectstart', prevent_asset_selection, true);

		return () => {
			document.removeEventListener('dragstart', prevent_asset_drag, true);
			document.removeEventListener('selectstart', prevent_asset_selection, true);
		};
	});
</script>

<svelte:head>
	<link rel="dns-prefetch" href="https://res.cloudinary.com" />
	<link rel="preconnect" href="https://res.cloudinary.com" crossorigin="anonymous" />
	<link rel="dns-prefetch" href="https://images.unsplash.com" />
	<link rel="preconnect" href="https://images.unsplash.com" crossorigin="anonymous" />
</svelte:head>
{@render children()}
