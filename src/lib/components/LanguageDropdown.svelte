<script lang="ts">
	import { onDestroy } from 'svelte';

	type DropdownItem = {
		country: string;
		label: string;
		dial_code: string;
	};

	let {
		items = [],
		value = $bindable(''),
		on_change,
		on_open_change
	}: {
		items?: DropdownItem[];
		value?: string;
		on_change?: (value: string) => void;
		on_open_change?: (open: boolean) => void;
	} = $props();

	let open = $state(false);
	let root_element = $state<HTMLDivElement | undefined>();

	const selected_item = $derived(items.find((item) => item.country === value) ?? items[0]);

	function toggle_dropdown() {
		open = !open;
		on_open_change?.(open);
	}

	function choose(item: DropdownItem) {
		value = item.country;
		on_change?.(item.country);
		open = false;
		on_open_change?.(false);
	}

	function handle_document_pointerdown(event: PointerEvent) {
		if (!open || !root_element) {
			return;
		}

		const target = event.target;

		if (target instanceof Node && root_element.contains(target)) {
			return;
		}

		open = false;
		on_open_change?.(false);
	}

	function handle_document_keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
			on_open_change?.(false);
		}
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('pointerdown', handle_document_pointerdown);
		document.addEventListener('keydown', handle_document_keydown);
	}

	onDestroy(() => {
		if (typeof document === 'undefined') {
			return;
		}

		document.removeEventListener('pointerdown', handle_document_pointerdown);
		document.removeEventListener('keydown', handle_document_keydown);
	});
</script>

<div
	bind:this={root_element}
	class="profile-phone-country-select relative isolate shrink-0"
	style:z-index={open ? '200' : 'auto'}
>
	<button
		type="button"
		class="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-sky-300/70"
		onclick={toggle_dropdown}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		<span class="truncate">
			{#if selected_item}
				{selected_item.label} +{selected_item.dial_code}
			{:else}
				Select country
			{/if}
		</span>
		<span class="ml-2 shrink-0">{open ? '^' : 'v'}</span>
	</button>

	{#if open}
		<div
			class="pointer-events-auto absolute top-full mt-2 w-full rounded-xl border border-white/12 bg-[#121324] p-1.5 shadow-xl"
			style="z-index: 210;"
		>
			<div class="flex flex-col gap-1" role="listbox">
				{#each items as item (item.country)}
					<button
						type="button"
						role="option"
						aria-selected={item.country === value}
						class="relative w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-tight text-slate-100 hover:bg-white/8"
						onclick={() => choose(item)}
					>
						{item.label} +{item.dial_code}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
