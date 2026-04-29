<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { background_video_post } from '$lib/state/background-video-post';

	let mobile_video_cancel_button = $state<HTMLButtonElement | undefined>();
	let is_mobile_video_cancel_revealed = $state(false);
	let is_mobile_video_cancel_target_active = $state(false);
	let is_mobile_video_progress_pressed = $state(false);
	let mobile_video_cancel_hold_timeout: ReturnType<typeof setTimeout> | undefined;

	const active_post = $derived($background_video_post);
	const is_active = $derived(
		active_post?.status === 'uploading' || active_post?.status === 'saving'
	);

	function clear_mobile_video_cancel_hold_timeout() {
		if (!mobile_video_cancel_hold_timeout) {
			return;
		}

		clearTimeout(mobile_video_cancel_hold_timeout);
		mobile_video_cancel_hold_timeout = undefined;
	}

	function reset_mobile_video_cancel_gesture() {
		clear_mobile_video_cancel_hold_timeout();
		is_mobile_video_cancel_revealed = false;
		is_mobile_video_cancel_target_active = false;
		is_mobile_video_progress_pressed = false;
	}

	function is_pointer_over_mobile_video_cancel_target(event: PointerEvent) {
		const rect = mobile_video_cancel_button?.getBoundingClientRect();

		if (!rect) {
			return false;
		}

		return (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		);
	}

	function begin_mobile_video_cancel_gesture(event: PointerEvent) {
		if (!is_active) {
			return;
		}

		event.preventDefault();
		is_mobile_video_progress_pressed = true;
		clear_mobile_video_cancel_hold_timeout();

		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// Ignore browsers that cannot capture this pointer.
		}

		mobile_video_cancel_hold_timeout = setTimeout(() => {
			is_mobile_video_cancel_revealed = true;
			mobile_video_cancel_hold_timeout = undefined;
		}, 420);
	}

	function move_mobile_video_cancel_gesture(event: PointerEvent) {
		if (!is_mobile_video_cancel_revealed) {
			return;
		}

		is_mobile_video_cancel_target_active = is_pointer_over_mobile_video_cancel_target(event);
	}

	function end_mobile_video_cancel_gesture(event: PointerEvent) {
		const should_cancel =
			is_mobile_video_cancel_revealed && is_pointer_over_mobile_video_cancel_target(event);

		reset_mobile_video_cancel_gesture();

		if (should_cancel) {
			active_post?.cancel();
		}
	}

	$effect(() => {
		if (active_post) {
			return;
		}

		reset_mobile_video_cancel_gesture();
	});
</script>

{#if active_post}
	<div
		class="fixed right-4 bottom-4 z-70 hidden w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_12%_0%,rgba(125,212,255,0.18),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(205,130,255,0.22),transparent_38%),linear-gradient(145deg,rgba(18,14,35,0.9),rgba(9,8,24,0.84))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_20px_60px_rgba(0,0,0,0.42),0_0_34px_rgba(125,212,255,0.12)] backdrop-blur-xl md:block"
		aria-live="polite"
		data-nonselectable-ui="true"
	>
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#7DD4FF]/70 to-transparent"
		></div>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="text-sm font-semibold">
					{#if active_post.status === 'uploading'}
						Uploading video
					{:else if active_post.status === 'saving'}
						Finishing post
					{:else if active_post.status === 'complete'}
						Video posted
					{:else}
						Upload failed
					{/if}
				</p>
				<p class="mt-1 truncate text-xs text-white/62">{active_post.file_name}</p>
			</div>

			{#if is_active}
				<button
					type="button"
					onclick={active_post.cancel}
					class="rounded-full border border-rose-300/30 bg-rose-950/80 px-3 py-1 text-xs font-semibold text-rose-50 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,box-shadow] hover:scale-[1.02] hover:border-rose-300/55 hover:bg-rose-700/50 hover:shadow-[inset_0_0_18px_rgba(251,113,133,0.1),0_0_18px_rgba(251,113,133,0.18),0_12px_26px_rgba(0,0,0,0.24)] active:scale-95"
				>
					Cancel
				</button>
			{:else}
				<button
					type="button"
					onclick={active_post.dismiss}
					class="grid h-7 w-7 place-items-center rounded-full border border-rose-300/30 bg-rose-950/80 text-sm text-rose-50 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,box-shadow] hover:scale-[1.04] hover:border-rose-300/55 hover:bg-rose-700/50 active:scale-95"
					aria-label="Dismiss video upload status"
				>
					x
				</button>
			{/if}
		</div>

		<div class="mt-3 h-2 overflow-hidden rounded-full bg-white/12" aria-hidden="true">
			<div
				class="h-full rounded-full bg-linear-to-r from-[#7DD4FF] to-[#CD82FF] transition-[width] duration-200"
				style={`width:${active_post.progress_percent}%;`}
			></div>
		</div>
		<div class="mt-2 flex items-center justify-between gap-3 text-xs text-white/62">
			<span>
				{#if active_post.status === 'saving'}
					Saving post...
				{:else if active_post.status === 'complete'}
					Ready in your profile.
				{:else if active_post.status === 'error'}
					{active_post.error_message}
				{:else}
					{active_post.progress_percent}%
				{/if}
			</span>
		</div>
		{#if active_post.is_cancel_confirming}
			<div
				class="mt-3 rounded-[1.1rem] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(125,212,255,0.12),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.035))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.22)]"
				transition:scale={{ duration: 180, start: 0.94, opacity: 0.4 }}
			>
				<p class="text-sm font-semibold text-white">Cancel video upload?</p>
				<p class="mt-1 text-xs leading-5 text-white/64">
					The upload will stop and this video post will not be created.
				</p>
				<div class="mt-3 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={active_post.keep_uploading}
						class="rounded-full border border-white/12 bg-white/7 px-3 py-2 text-xs font-semibold text-white/78 transition-[transform,background-color,color,border-color] duration-160 hover:scale-[1.02] hover:bg-white/12 hover:text-white active:scale-95"
					>
						Keep uploading
					</button>
					<button
						type="button"
						onclick={active_post.confirm_cancel}
						class="rounded-full border border-rose-300/30 bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-50 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,box-shadow] hover:scale-[1.02] hover:border-rose-300/55 hover:bg-rose-700/50 active:scale-95"
					>
						Cancel upload
					</button>
				</div>
			</div>
		{/if}
	</div>

	<div
		class="fixed top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] right-4 z-70 md:hidden"
		aria-live="polite"
		data-nonselectable-ui="true"
	>
		{#if is_mobile_video_cancel_revealed && is_active}
			<button
				bind:this={mobile_video_cancel_button}
				type="button"
				class={`absolute top-1/2 right-[4.6rem] -translate-y-1/2 rounded-full border border-rose-300/30 bg-rose-950/80 px-3 py-2 text-xs font-semibold text-rose-50 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-[transform,box-shadow,background-color,border-color] duration-180 ease-out hover:scale-105 hover:border-rose-300/55 hover:bg-rose-700/50 active:scale-95 ${is_mobile_video_cancel_target_active ? 'scale-110 shadow-[0_0_24px_rgba(251,113,133,0.28)]' : ''}`}
				transition:scale={{ duration: 180, start: 0.72, opacity: 0.4 }}
			>
				Cancel
			</button>
		{/if}
		<button
			type="button"
			class={`relative grid h-15 w-15 touch-none place-items-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_35%_18%,rgba(125,212,255,0.24),transparent_38%),linear-gradient(145deg,rgba(18,14,35,0.9),rgba(9,8,24,0.82))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_34px_rgba(0,0,0,0.38),0_0_28px_rgba(125,212,255,0.16)] backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-180 ease-out hover:scale-105 active:scale-95 ${is_mobile_video_progress_pressed ? 'scale-92 border-[#7DD4FF]/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_22px_rgba(0,0,0,0.42),0_0_34px_rgba(125,212,255,0.24)]' : ''}`}
			aria-label="Video upload progress"
			onpointerdown={begin_mobile_video_cancel_gesture}
			onpointermove={move_mobile_video_cancel_gesture}
			onpointerup={end_mobile_video_cancel_gesture}
			onpointercancel={reset_mobile_video_cancel_gesture}
			onpointerleave={() => {
				if (!is_mobile_video_cancel_revealed) {
					is_mobile_video_progress_pressed = false;
				}
			}}
		>
			<svg
				class="pointer-events-none absolute top-1/2 left-1/2 h-13 w-13 -translate-x-1/2 -translate-y-1/2 -rotate-90"
				viewBox="0 0 48 48"
				aria-hidden="true"
			>
				<circle
					cx="24"
					cy="24"
					r="20"
					fill="none"
					stroke="rgba(255,255,255,0.12)"
					stroke-width="4"
				/>
				<circle
					cx="24"
					cy="24"
					r="20"
					fill="none"
					stroke="url(#mobile-video-upload-progress)"
					stroke-linecap="round"
					stroke-width="4"
					style={`stroke-dasharray:126;stroke-dashoffset:${126 - (126 * active_post.progress_percent) / 100};`}
				/>
				<defs>
					<linearGradient id="mobile-video-upload-progress" x1="0" x2="1" y1="0" y2="1">
						<stop offset="0%" stop-color="#7DD4FF" />
						<stop offset="100%" stop-color="#CD82FF" />
					</linearGradient>
				</defs>
			</svg>
			<span class="pointer-events-none relative text-[11px] font-bold text-white">
				{active_post.status === 'saving'
					? '...'
					: active_post.status === 'complete'
						? 'Done'
						: `${active_post.progress_percent}%`}
			</span>
		</button>
	</div>

	{#if active_post.is_cancel_confirming}
		<div
			class="fixed inset-0 z-80 grid place-items-center bg-black/52 px-4 backdrop-blur-sm md:hidden"
			data-nonselectable-ui="true"
			transition:fade={{ duration: 160 }}
		>
			<div
				class="w-full max-w-xs rounded-2xl border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(125,212,255,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(205,130,255,0.16),transparent_42%),linear-gradient(145deg,rgba(18,14,35,0.96),rgba(9,8,24,0.92))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_24px_70px_rgba(0,0,0,0.46)]"
				transition:scale={{ duration: 190, start: 0.9, opacity: 0.4 }}
			>
				<p class="text-base font-semibold">Cancel video upload?</p>
				<p class="mt-2 text-sm leading-6 text-white/66">
					The upload will stop and this video post will not be created.
				</p>
				<div class="mt-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={active_post.keep_uploading}
						class="rounded-full border border-white/12 bg-white/7 px-3 py-2.5 text-xs font-semibold text-white/78 transition-[transform,background-color,color,border-color] duration-160 hover:scale-[1.02] hover:bg-white/12 hover:text-white active:scale-95"
					>
						Keep uploading
					</button>
					<button
						type="button"
						onclick={active_post.confirm_cancel}
						class="rounded-full border border-rose-300/30 bg-rose-950/80 px-3 py-2.5 text-xs font-semibold text-rose-50 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,box-shadow] hover:scale-[1.02] hover:border-rose-300/55 hover:bg-rose-700/50 active:scale-95"
					>
						Cancel upload
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if active_post.status === 'complete'}
		<div
			class="pointer-events-none fixed inset-0 z-80 grid place-items-center px-4"
			data-nonselectable-ui="true"
		>
			<div
				class="pointer-events-auto w-full max-w-xs rounded-2xl border border-white/14 bg-[radial-gradient(circle_at_top_left,rgba(125,212,255,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(205,130,255,0.16),transparent_42%),linear-gradient(145deg,rgba(18,14,35,0.96),rgba(9,8,24,0.92))] p-4 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl"
				transition:scale={{ duration: 190, start: 0.9, opacity: 0.4 }}
			>
				<p class="text-base font-semibold">Video posted</p>
				<p class="mt-2 text-sm leading-6 text-white/66">Your video is ready on your profile.</p>
				<button
					type="button"
					onclick={active_post.dismiss}
					class="mt-4 rounded-full border border-white/12 bg-white/7 px-4 py-2.5 text-xs font-semibold text-white/78 transition-[transform,background-color,color,border-color] duration-160 hover:scale-[1.02] hover:bg-white/12 hover:text-white active:scale-95"
				>
					Done
				</button>
			</div>
		</div>
	{/if}
{/if}
