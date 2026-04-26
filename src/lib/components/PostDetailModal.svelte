<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';
	import type { PostFeedPost } from '$lib/types/post-feed';
	import type { PostComment } from '$lib/types/comment';

	type Props = {
		post: PostFeedPost;
		liked: boolean;
		on_close: () => void;
		on_comment_count_change?: (count: number) => void;
		on_like: () => void;
		on_video_preview?: (src: string, alt: string) => void;
	};

	const { post, liked, on_close, on_comment_count_change, on_like, on_video_preview }: Props =
		$props();

	const current_user_id = $derived(
		(page.data as { current_user_id?: string }).current_user_id ?? ''
	);

	let panel_el = $state<HTMLDivElement | undefined>();
	let comment_list = $state<PostComment[]>([]);
	let has_more = $state(false);
	let next_cursor = $state<string | undefined>();
	let is_loading = $state(true);
	let is_loading_more = $state(false);
	let comment_input = $state('');
	let is_submitting = $state(false);
	let submit_error = $state('');
	let confirm_delete_id = $state<string>();
	let deleting_comment_id = $state<string>();
	let comment_count = $state(0);
	let inline_video_el = $state<HTMLVideoElement | undefined>();
	let inline_video_current_time = $state(0);
	let inline_video_duration = $state(0);
	let inline_video_is_playing = $state(false);
	let inline_video_volume = $state(100);
	let inline_video_brightness = $state(100);
	let inline_video_controls_visible = $state(true);
	let inline_video_controls_region_active = $state(false);
	let is_compact_inline_video = $state(false);
	let inline_video_active_setting = $state<'brightness' | 'volume' | undefined>();
	let inline_video_touch_setting_panel = $state<'brightness' | 'volume' | undefined>();
	let inline_video_click_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let inline_video_controls_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let inline_video_seek_pointer_id = $state<number | undefined>();
	let inline_video_seek_grab_offset_x = $state(0);
	let inline_video_should_ignore_next_click = $state(false);
	let inline_video_setting_drag_state = $state<
		| {
				has_moved: boolean;
				panel: 'brightness' | 'volume';
				pointer_id: number;
				start_value: number;
				start_x: number;
				start_y: number;
				target: HTMLElement;
		  }
		| undefined
	>();
	let drag_close_hold_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let drag_close_pending = $state<
		| {
				pointer_id: number;
				start_x: number;
				start_y: number;
				target: HTMLElement;
		  }
		| undefined
	>();
	let drag_close_state = $state<
		| {
				pointer_id: number;
				start_x: number;
				start_y: number;
				target: HTMLElement;
		  }
		| undefined
	>();
	let drag_close_offset_x = $state(0);
	let drag_close_offset_y = $state(0);

	const drag_close_hold_delay_ms = 260;
	const drag_close_click_suppression_distance = 12;
	const drag_close_distance = 110;
	const inline_video_controls_hide_delay_ms = 1000;
	const inline_video_mobile_tap_controls_hide_delay_ms = 5000;
	const inline_video_start_display_snap_seconds = 0.05;
	const inline_video_end_display_snap_seconds = 0.05;
	const inline_video_drag_click_suppression_distance = 12;
	const inline_video_setting_drag_sensitivity = 0.65;

	function set_comment_count(next_count: number) {
		comment_count = next_count;
		on_comment_count_change?.(next_count);
	}

	function format_media_time(seconds: number) {
		const normalized = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(normalized / 60);
		const remaining_seconds = normalized % 60;
		return `${minutes}:${String(remaining_seconds).padStart(2, '0')}`;
	}

	function sync_inline_video_time() {
		if (!inline_video_el) return;
		const next_duration = Number.isFinite(inline_video_el.duration) ? inline_video_el.duration : 0;
		inline_video_current_time =
			next_duration > 0 && next_duration - inline_video_el.currentTime <= 0.05
				? next_duration
				: inline_video_el.currentTime;
		inline_video_duration = next_duration;
		inline_video_is_playing = !inline_video_el.paused;
	}

	function sync_inline_video_viewport() {
		if (typeof window === 'undefined') return;
		is_compact_inline_video = window.matchMedia('(max-width: 767px)').matches;
	}

	function apply_inline_video_settings() {
		if (!inline_video_el) return;
		inline_video_el.muted = false;
		inline_video_el.volume = Math.max(0, Math.min(inline_video_volume / 100, 1));
	}

	function toggle_inline_video_playback() {
		if (!inline_video_el) return;
		clear_inline_video_click_timeout();
		if (inline_video_el.paused) {
			void inline_video_el.play();
		} else {
			inline_video_el.pause();
		}
		sync_inline_video_time();
	}

	function seek_inline_video(seconds: number) {
		if (!inline_video_el) return;
		clear_inline_video_click_timeout();
		const current_seek_value = get_inline_video_seek_value();
		const duration = inline_video_el.duration || inline_video_duration || 0;

		if (seconds < 0 && current_seek_value <= 0) {
			inline_video_el.currentTime = 0;
			inline_video_current_time = 0;
			inline_video_seek_grab_offset_x = 0;
			return;
		}

		if (seconds > 0 && duration > 0 && current_seek_value >= duration) {
			inline_video_el.currentTime = duration;
			inline_video_current_time = duration;
			inline_video_seek_grab_offset_x = 0;
			return;
		}

		const next_time = Math.max(0, Math.min(inline_video_el.currentTime + seconds, duration));
		inline_video_el.currentTime = next_time;
		inline_video_current_time = next_time;
		sync_inline_video_time();
	}

	function seek_inline_video_to_time(next_time: number) {
		if (!inline_video_el) return;
		const duration = inline_video_el.duration || inline_video_duration || 0;
		const clamped_time = Math.max(0, Math.min(next_time, duration));
		inline_video_el.currentTime = clamped_time;
		inline_video_current_time = clamped_time;
		inline_video_duration = Number.isFinite(inline_video_el.duration)
			? inline_video_el.duration
			: inline_video_duration;
		show_inline_video_controls();
	}

	function get_inline_video_seek_value() {
		if (inline_video_duration <= 0) return 0;
		const clamped_current_time = Math.min(inline_video_current_time, inline_video_duration);
		const remaining = inline_video_duration - clamped_current_time;

		if (clamped_current_time < inline_video_start_display_snap_seconds) return 0;
		if (remaining <= inline_video_end_display_snap_seconds) return inline_video_duration;
		return clamped_current_time;
	}

	function get_inline_video_seek_ratio() {
		if (inline_video_duration <= 0) return 0;
		return Math.max(0, Math.min(get_inline_video_seek_value() / inline_video_duration, 1));
	}

	function seek_inline_video_from_pointer(event: PointerEvent) {
		if (!inline_video_el || inline_video_duration <= 0) return;
		const slider = event.currentTarget as HTMLElement;
		const bounds = slider.getBoundingClientRect();
		const adjusted_x = event.clientX - inline_video_seek_grab_offset_x;
		const ratio = Math.max(0, Math.min((adjusted_x - bounds.left) / bounds.width, 1));
		const next_time = ratio * inline_video_duration;
		seek_inline_video_to_time(next_time <= inline_video_start_display_snap_seconds ? 0 : next_time);
	}

	function begin_inline_video_seek_drag(event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
		inline_video_active_setting = undefined;
		inline_video_seek_pointer_id = event.pointerId;
		const slider = event.currentTarget as HTMLElement;
		const bounds = slider.getBoundingClientRect();
		const thumb_center_x = bounds.left + get_inline_video_seek_ratio() * bounds.width;
		const thumb_radius = bounds.height / 2;
		inline_video_seek_grab_offset_x =
			Math.abs(event.clientX - thumb_center_x) <= thumb_radius * 1.35
				? event.clientX - thumb_center_x
				: 0;
		slider.setPointerCapture(event.pointerId);
		seek_inline_video_from_pointer(event);
	}

	function move_inline_video_seek_drag(event: PointerEvent) {
		if (inline_video_seek_pointer_id !== event.pointerId) return;
		event.preventDefault();
		event.stopPropagation();
		seek_inline_video_from_pointer(event);
	}

	function end_inline_video_seek_drag(event: PointerEvent) {
		if (inline_video_seek_pointer_id !== event.pointerId) return;
		event.preventDefault();
		event.stopPropagation();
		inline_video_seek_pointer_id = undefined;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		seek_inline_video_from_pointer(event);
		inline_video_seek_grab_offset_x = 0;
	}

	function handle_inline_video_seek(event: Event) {
		seek_inline_video_to_time(Number((event.currentTarget as HTMLInputElement).value));
	}

	function handle_inline_video_setting_input(setting: 'brightness' | 'volume', event: Event) {
		clear_inline_video_click_timeout();
		show_inline_video_controls();
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (setting === 'brightness') {
			inline_video_brightness = value;
		} else {
			inline_video_volume = value;
			apply_inline_video_settings();
		}
	}

	function toggle_inline_video_setting(setting: 'brightness' | 'volume') {
		clear_inline_video_click_timeout();
		inline_video_active_setting = inline_video_active_setting === setting ? undefined : setting;
		show_inline_video_controls();
	}

	function get_inline_video_setting_fill_percent(setting: 'brightness' | 'volume') {
		if (setting === 'brightness') {
			return ((inline_video_brightness - 40) / (160 - 40)) * 100;
		}

		return inline_video_volume;
	}

	function clear_inline_video_click_timeout() {
		if (!inline_video_click_timeout) return;
		clearTimeout(inline_video_click_timeout);
		inline_video_click_timeout = undefined;
	}

	function clear_inline_video_controls_timeout() {
		if (!inline_video_controls_timeout) return;
		clearTimeout(inline_video_controls_timeout);
		inline_video_controls_timeout = undefined;
	}

	function show_inline_video_controls() {
		inline_video_controls_visible = true;
		schedule_inline_video_controls_hide();
	}

	function schedule_inline_video_controls_hide(delay_ms = inline_video_controls_hide_delay_ms) {
		clear_inline_video_controls_timeout();
		if (inline_video_controls_region_active) return;

		inline_video_controls_timeout = setTimeout(() => {
			inline_video_controls_timeout = undefined;
			if (!inline_video_controls_region_active) inline_video_controls_visible = false;
		}, delay_ms);
	}

	function toggle_inline_video_controls() {
		clear_inline_video_controls_timeout();
		inline_video_controls_region_active = false;
		inline_video_active_setting = undefined;

		if (inline_video_controls_visible) {
			inline_video_controls_visible = false;
			return;
		}

		inline_video_controls_visible = true;
		schedule_inline_video_controls_hide(
			is_compact_inline_video
				? inline_video_mobile_tap_controls_hide_delay_ms
				: inline_video_controls_hide_delay_ms
		);
	}

	function is_inline_video_control_target(target: EventTarget | null) {
		return Boolean(
			target instanceof Element && target.closest('[data-video-preview-control="true"]')
		);
	}

	function set_inline_video_controls_region_active(is_active: boolean) {
		inline_video_controls_region_active = is_active;

		if (is_active) {
			inline_video_controls_visible = true;
			clear_inline_video_controls_timeout();
			return;
		}

		schedule_inline_video_controls_hide();
	}

	function release_inline_video_controls_region_for_touch(event: PointerEvent) {
		if (event.pointerType === 'mouse') return;
		set_inline_video_controls_region_active(false);
	}

	function is_text_entry_target(target: EventTarget | null) {
		return Boolean(
			target instanceof HTMLElement &&
			target.closest(
				'button, a, input, textarea, select, [contenteditable=""], [contenteditable="true"]'
			)
		);
	}

	function handle_inline_video_keydown(event: KeyboardEvent) {
		if (is_text_entry_target(event.target)) return;
		if (post.media_type !== 'video' || !post.media_url) return;

		if (event.key === ' ' || event.key.toLowerCase() === 'k') {
			event.preventDefault();
			event.stopPropagation();
			toggle_inline_video_playback();
			return;
		}

		if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'j') {
			event.preventDefault();
			event.stopPropagation();
			seek_inline_video(-5);
			return;
		}

		if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'l') {
			event.preventDefault();
			event.stopPropagation();
			seek_inline_video(5);
		}
	}

	function get_inline_video_display_bounds() {
		if (!inline_video_el) return;
		const bounds = inline_video_el.getBoundingClientRect();
		const media_width = inline_video_el.videoWidth;
		const media_height = inline_video_el.videoHeight;

		if (media_width <= 0 || media_height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
			return bounds;
		}

		const scale = Math.min(bounds.width / media_width, bounds.height / media_height);
		const width = media_width * scale;
		const height = media_height * scale;
		const left = bounds.left + (bounds.width - width) / 2;
		const top = bounds.top + (bounds.height - height) / 2;
		return new DOMRect(left, top, width, height);
	}

	function get_inline_video_setting_panel_from_point(event: PointerEvent) {
		if (!(event.currentTarget instanceof HTMLElement)) return;
		const preview_bounds = event.currentTarget.getBoundingClientRect();

		const is_inside_preview =
			event.clientX >= preview_bounds.left &&
			event.clientX <= preview_bounds.right &&
			event.clientY >= preview_bounds.top &&
			event.clientY <= preview_bounds.bottom;

		if (!is_inside_preview) return;
		return event.clientX < preview_bounds.left + preview_bounds.width / 2 ? 'brightness' : 'volume';
	}

	function update_inline_video_setting_from_drag(event: PointerEvent) {
		if (!inline_video_setting_drag_state) return;
		const delta_y = inline_video_setting_drag_state.start_y - event.clientY;
		const next_value =
			inline_video_setting_drag_state.start_value + delta_y * inline_video_setting_drag_sensitivity;

		if (inline_video_setting_drag_state.panel === 'brightness') {
			inline_video_brightness = Math.round(Math.max(40, Math.min(next_value, 160)));
			return;
		}

		inline_video_volume = Math.round(Math.max(0, Math.min(next_value, 100)));
		apply_inline_video_settings();
	}

	function begin_inline_video_drag(event: PointerEvent) {
		if (is_inline_video_control_target(event.target)) return;
		inline_video_should_ignore_next_click = false;
		const setting_panel = get_inline_video_setting_panel_from_point(event);
		if (!setting_panel) return;

		inline_video_setting_drag_state = {
			has_moved: false,
			panel: setting_panel,
			pointer_id: event.pointerId,
			start_value: setting_panel === 'brightness' ? inline_video_brightness : inline_video_volume,
			start_x: event.clientX,
			start_y: event.clientY,
			target: event.currentTarget as HTMLElement
		};
	}

	function start_inline_video_setting_drag(event: PointerEvent) {
		const setting_drag_state = inline_video_setting_drag_state;
		if (!setting_drag_state || setting_drag_state.pointer_id !== event.pointerId) return false;
		if (setting_drag_state.has_moved) return true;

		const horizontal_distance = Math.abs(event.clientX - setting_drag_state.start_x);
		const vertical_distance = Math.abs(event.clientY - setting_drag_state.start_y);
		if (
			vertical_distance <= inline_video_drag_click_suppression_distance ||
			vertical_distance <= horizontal_distance
		) {
			return false;
		}

		setting_drag_state.has_moved = true;
		inline_video_touch_setting_panel = setting_drag_state.panel;
		inline_video_active_setting = undefined;
		inline_video_controls_visible = false;
		inline_video_should_ignore_next_click = true;
		clear_inline_video_click_timeout();
		clear_inline_video_controls_timeout();
		setting_drag_state.target.setPointerCapture(event.pointerId);
		return true;
	}

	function move_inline_video_drag(event: PointerEvent) {
		if (!start_inline_video_setting_drag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		update_inline_video_setting_from_drag(event);
	}

	function release_inline_video_setting_drag_capture(event: PointerEvent) {
		const setting_drag_state = inline_video_setting_drag_state;
		if (!setting_drag_state?.has_moved) return;
		if (setting_drag_state.target.hasPointerCapture(event.pointerId)) {
			setting_drag_state.target.releasePointerCapture(event.pointerId);
		}
	}

	function clear_inline_video_setting_drag() {
		inline_video_setting_drag_state = undefined;
		inline_video_touch_setting_panel = undefined;
	}

	function end_inline_video_drag(event: PointerEvent) {
		if (
			inline_video_setting_drag_state &&
			inline_video_setting_drag_state.pointer_id === event.pointerId
		) {
			if (inline_video_setting_drag_state.has_moved) {
				event.preventDefault();
				event.stopPropagation();
				inline_video_should_ignore_next_click = true;
				release_inline_video_setting_drag_capture(event);
			}

			clear_inline_video_setting_drag();
		}
	}

	function cancel_inline_video_drag(event: PointerEvent) {
		if (
			inline_video_setting_drag_state &&
			inline_video_setting_drag_state.pointer_id === event.pointerId
		) {
			release_inline_video_setting_drag_capture(event);
			clear_inline_video_setting_drag();
		}
	}

	function handle_inline_video_stage_click(event: Event) {
		if (is_inline_video_control_target(event.target)) return;

		if (inline_video_should_ignore_next_click) {
			inline_video_should_ignore_next_click = false;
			clear_inline_video_click_timeout();
			return;
		}

		inline_video_active_setting = undefined;
		clear_inline_video_click_timeout();
		inline_video_click_timeout = setTimeout(() => {
			if (is_compact_inline_video) {
				toggle_inline_video_controls();
				inline_video_click_timeout = undefined;
				return;
			}

			toggle_inline_video_playback();
			inline_video_click_timeout = undefined;
		}, 220);
	}

	function handle_inline_video_stage_double_click(event: MouseEvent) {
		if (is_inline_video_control_target(event.target)) return;
		clear_inline_video_click_timeout();

		if (is_compact_inline_video) {
			const media_bounds = get_inline_video_display_bounds();
			if (!media_bounds) return;

			const is_inside_media =
				event.clientX >= media_bounds.left &&
				event.clientX <= media_bounds.right &&
				event.clientY >= media_bounds.top &&
				event.clientY <= media_bounds.bottom;

			if (!is_inside_media) return;
			seek_inline_video(event.clientX < media_bounds.left + media_bounds.width / 2 ? -5 : 5);
			return;
		}

		if (!(event.currentTarget instanceof HTMLElement)) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		const relative_x = event.clientX - bounds.left;

		if (relative_x < bounds.width * 0.35) {
			seek_inline_video(-5);
			return;
		}

		if (relative_x > bounds.width * 0.65) {
			seek_inline_video(5);
			return;
		}

		toggle_inline_video_playback();
	}

	function open_inline_video_preview() {
		inline_video_el?.pause();
		sync_inline_video_time();
		on_video_preview?.(post.media_url ?? '', `${post.author_name}'s post video`);
	}

	function handle_inline_video_preview_click(event: MouseEvent) {
		event.stopPropagation();
		open_inline_video_preview();
	}

	function handle_inline_video_playback_click(event: MouseEvent) {
		event.stopPropagation();
		toggle_inline_video_playback();
	}

	function handle_inline_video_seek_click(event: MouseEvent, seconds: number) {
		event.stopPropagation();
		seek_inline_video(seconds);
	}

	function handle_inline_video_setting_click(event: MouseEvent, setting: 'brightness' | 'volume') {
		event.stopPropagation();
		toggle_inline_video_setting(setting);
	}

	function time_ago(date: Date): string {
		const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
		if (seconds < 60) return 'a few moments ago';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			const rounded = minutes < 5 ? 1 : Math.floor(minutes / 5) * 5;
			return `${rounded} minute${rounded === 1 ? '' : 's'} ago`;
		}
		const hours = Math.floor(seconds / 3600);
		if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		const days = Math.floor(seconds / 86400);
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}

	async function load_comments(cursor?: string) {
		const query = cursor ? `limit=20&cursor=${encodeURIComponent(cursor)}` : 'limit=20';

		const res = await fetch(`/api/posts/${post.id}/comments?${query}`);
		if (!res.ok) return;

		const data = (await res.json()) as {
			comments: PostComment[];
			has_more: boolean;
			next_cursor?: string;
			total_count: number;
		};

		if (cursor) {
			comment_list = [...comment_list, ...data.comments];
		} else {
			comment_list = data.comments;
		}
		has_more = data.has_more;
		next_cursor = data.next_cursor;
		set_comment_count(data.total_count);
	}

	async function load_more() {
		if (!has_more || is_loading_more) return;
		is_loading_more = true;
		await load_comments(next_cursor);
		is_loading_more = false;
	}

	async function scroll_to_comment(comment_id: string) {
		await tick();
		const comment_node = panel_el?.querySelector<HTMLElement>(
			`[data-comment-id="${CSS.escape(comment_id)}"]`
		);
		comment_node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	async function submit_comment() {
		const content = comment_input.trim();
		if (!content || is_submitting) return;

		is_submitting = true;
		submit_error = '';

		try {
			const res = await fetch(`/api/posts/${post.id}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ content })
			});

			if (res.status === 429) {
				submit_error = 'Too many comments. Please slow down.';
				return;
			}

			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				submit_error = body.error ?? 'Failed to post comment.';
				return;
			}

			const new_comment = (await res.json()) as PostComment;
			comment_list = [new_comment, ...comment_list];
			set_comment_count(comment_count + 1);
			comment_input = '';
			await scroll_to_comment(new_comment.id);
		} catch {
			submit_error = 'Something went wrong. Please try again.';
		} finally {
			is_submitting = false;
		}
	}

	async function handle_delete(comment_id: string) {
		if (deleting_comment_id) {
			return;
		}

		deleting_comment_id = comment_id;

		try {
			const res = await fetch(`/api/comments/${comment_id}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				comment_list = comment_list.filter((c) => c.id !== comment_id);
				set_comment_count(Math.max(0, comment_count - 1));
				confirm_delete_id = undefined;
			}
		} finally {
			deleting_comment_id = undefined;
		}
	}

	function is_drag_close_interactive(target: EventTarget | null) {
		return Boolean(
			target instanceof HTMLElement &&
			target.closest(
				'button, input, textarea, select, video, a, [data-comment-preview-control="true"]'
			)
		);
	}

	function clear_drag_close_hold() {
		if (drag_close_hold_timeout) {
			clearTimeout(drag_close_hold_timeout);
			drag_close_hold_timeout = undefined;
		}
		drag_close_pending = undefined;
	}

	function begin_drag_close(event: PointerEvent) {
		if (event.button !== 0 || is_drag_close_interactive(event.target)) {
			return;
		}

		clear_drag_close_hold();
		drag_close_state = undefined;
		drag_close_offset_x = 0;
		drag_close_offset_y = 0;

		const target = event.currentTarget as HTMLElement;
		drag_close_pending = {
			pointer_id: event.pointerId,
			start_x: event.clientX,
			start_y: event.clientY,
			target
		};

		drag_close_hold_timeout = setTimeout(() => {
			const pending = drag_close_pending;
			drag_close_hold_timeout = undefined;
			if (!pending || pending.pointer_id !== event.pointerId) return;

			drag_close_state = pending;
			drag_close_pending = undefined;
			pending.target.setPointerCapture(pending.pointer_id);
		}, drag_close_hold_delay_ms);
	}

	function move_drag_close(event: PointerEvent) {
		const pending = drag_close_pending;
		if (pending?.pointer_id === event.pointerId) {
			const pending_distance = Math.hypot(
				event.clientX - pending.start_x,
				event.clientY - pending.start_y
			);
			if (pending_distance > drag_close_click_suppression_distance) {
				clear_drag_close_hold();
			}
		}

		if (!drag_close_state || drag_close_state.pointer_id !== event.pointerId) {
			return;
		}

		drag_close_offset_x = event.clientX - drag_close_state.start_x;
		drag_close_offset_y = event.clientY - drag_close_state.start_y;
	}

	function end_drag_close(event: PointerEvent) {
		if (drag_close_pending?.pointer_id === event.pointerId) {
			clear_drag_close_hold();
		}

		if (!drag_close_state || drag_close_state.pointer_id !== event.pointerId) {
			return;
		}

		const distance = Math.hypot(drag_close_offset_x, drag_close_offset_y);
		const target = drag_close_state.target;
		drag_close_state = undefined;
		drag_close_offset_x = 0;
		drag_close_offset_y = 0;
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		if (distance > drag_close_distance) {
			on_close();
		}
	}

	function cancel_drag_close(event: PointerEvent) {
		if (drag_close_pending?.pointer_id === event.pointerId) {
			clear_drag_close_hold();
		}

		if (!drag_close_state || drag_close_state.pointer_id !== event.pointerId) {
			return;
		}

		const target = drag_close_state.target;
		drag_close_state = undefined;
		drag_close_offset_x = 0;
		drag_close_offset_y = 0;
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
	}

	onMount(() => {
		sync_inline_video_viewport();
		window.addEventListener('resize', sync_inline_video_viewport);
		set_comment_count(post.comment_count);
		panel_el?.focus();

		void load_comments().finally(() => {
			is_loading = false;
		});

		return () => {
			window.removeEventListener('resize', sync_inline_video_viewport);
			inline_video_el?.pause();
			clear_inline_video_click_timeout();
			clear_inline_video_controls_timeout();
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			on_close();
		}
	}}
/>

<div
	class="fixed inset-0 z-150 flex h-dvh w-screen items-start justify-center overflow-hidden bg-black/85 p-0 backdrop-blur-md md:items-center md:p-6"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) on_close();
	}}
	onkeydown={(e) => {
		if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
			e.preventDefault();
			on_close();
		}
	}}
	onpointerdown={begin_drag_close}
	onpointermove={move_drag_close}
	onpointerup={end_drag_close}
	onpointercancel={cancel_drag_close}
	transition:fade={{ duration: 180 }}
>
	<div
		bind:this={panel_el}
		role="dialog"
		aria-modal="true"
		aria-label="Post detail"
		tabindex="-1"
		onkeydown={handle_inline_video_keydown}
		class="comment-preview-panel relative flex h-dvh w-screen max-w-full flex-col overflow-x-hidden overflow-y-auto bg-[#0d0921] shadow-[inset_1px_-1px_40px_0px_#CD82FF44,0_20px_80px_rgba(0,0,0,0.7)] outline-none md:h-full md:max-h-[88dvh] md:max-w-5xl md:flex-row md:overflow-hidden md:rounded-2xl"
		style={drag_close_state
			? `transform: translate3d(${drag_close_offset_x}px, ${drag_close_offset_y}px, 0) scale(0.985); opacity: 0.92;`
			: undefined}
		transition:scale={{ duration: 220, start: 0.94, opacity: 0.55 }}
	>
		<!-- Left: Media -->
		<div
			class="relative flex h-[clamp(210px,42dvh,430px)] min-h-0 shrink-0 items-center justify-center overflow-hidden bg-black/20 md:h-full md:flex-1 md:rounded-l-2xl"
		>
			{#if post.media_url && post.media_type === 'image'}
				<ProgressiveImage
					src={post.media_display_url ?? post.media_url}
					srcset={post.media_display_srcset}
					alt={`${post.author_name}'s post`}
					wrapper_class="h-full w-full"
					img_class="h-full w-full object-contain"
					skeleton_class="rounded-none"
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>
			{:else if post.media_url && post.media_type === 'video'}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="comment-inline-video group relative h-full w-full overflow-hidden bg-black"
					role="application"
					tabindex="0"
					data-comment-preview-control="true"
					aria-label={`${post.author_name}'s inline video player`}
					onkeydown={handle_inline_video_keydown}
					onclick={handle_inline_video_stage_click}
					ondblclick={handle_inline_video_stage_double_click}
					onpointerdown={begin_inline_video_drag}
					onpointermove={move_inline_video_drag}
					onpointerup={end_inline_video_drag}
					onpointercancel={cancel_inline_video_drag}
				>
					<video
						bind:this={inline_video_el}
						src={post.media_url}
						class="comment-inline-video-media bg-black"
						style={`filter:brightness(${inline_video_brightness}%);`}
						autoplay
						loop
						muted={false}
						playsinline
						preload="metadata"
						onloadedmetadata={() => {
							apply_inline_video_settings();
							sync_inline_video_time();
							void inline_video_el?.play().catch(() => {
								inline_video_is_playing = false;
							});
						}}
						ontimeupdate={sync_inline_video_time}
						onplay={sync_inline_video_time}
						onplaying={sync_inline_video_time}
						onpause={sync_inline_video_time}
					></video>

					{#if inline_video_touch_setting_panel}
						<div
							class="video-preview-gesture-setting-panel pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 {inline_video_touch_setting_panel ===
							'brightness'
								? 'left-[max(1rem,env(safe-area-inset-left))] md:left-8'
								: 'right-[max(1rem,env(safe-area-inset-right))] md:right-8'}"
							aria-hidden="true"
						>
							<div class="video-preview-setting-track">
								<div
									class="video-preview-setting-fill"
									style={`height:${get_inline_video_setting_fill_percent(inline_video_touch_setting_panel)}%;`}
								></div>
								<span class="video-preview-setting-value">
									{inline_video_touch_setting_panel === 'brightness'
										? inline_video_brightness
										: inline_video_volume}%
								</span>
								{#if inline_video_touch_setting_panel === 'brightness'}
									<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-setting-icon">
										<circle
											cx="12"
											cy="12"
											r="3.1"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										/>
										<path
											d="M12 2.8v2.1M12 19.1v2.1M5.5 5.5 7 7M17 17l1.5 1.5M2.8 12h2.1M19.1 12h2.1M5.5 18.5 7 17M17 7l1.5-1.5"
											fill="none"
											stroke="currentColor"
											stroke-linecap="round"
											stroke-width="2"
										/>
									</svg>
								{:else}
									<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-setting-icon">
										<path
											d="M4.5 14.4h3.7l4.2 3.2V6.4L8.2 9.6H4.5z"
											fill="none"
											stroke="currentColor"
											stroke-linejoin="round"
											stroke-width="2"
										/>
										<path
											d="M16.1 9.3a3.8 3.8 0 0 1 0 5.4M18.5 7.1a6.8 6.8 0 0 1 0 9.8"
											fill="none"
											stroke="currentColor"
											stroke-linecap="round"
											stroke-width="2"
										/>
									</svg>
								{/if}
							</div>
						</div>
					{/if}
					<div
						class="video-preview-bottom-hover-zone absolute inset-x-0 bottom-0 z-19"
						aria-hidden="true"
						onpointerenter={() => set_inline_video_controls_region_active(true)}
						onpointermove={() => set_inline_video_controls_region_active(true)}
						onpointerleave={() => set_inline_video_controls_region_active(false)}
						onpointerdown={() => {
							set_inline_video_controls_region_active(true);
						}}
						onpointerup={release_inline_video_controls_region_for_touch}
						onpointercancel={release_inline_video_controls_region_for_touch}
					></div>
					<button
						type="button"
						data-comment-preview-control="true"
						data-video-preview-control="true"
						class="comment-video-expand-button pointer-events-auto absolute top-3 right-3 z-20"
						onclick={handle_inline_video_preview_click}
						aria-label={`Open ${post.author_name}'s video preview`}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true" class="comment-video-expand-svg">
							<path
								d="M8.2 4.5H4.5v3.7M4.5 4.5l5.7 5.7M15.8 19.5h3.7v-3.7M19.5 19.5l-5.7-5.7"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
							/>
							<rect
								x="7.3"
								y="7.3"
								width="9.4"
								height="9.4"
								rx="2.2"
								fill="none"
								stroke="currentColor"
								stroke-width="1.45"
								opacity="0.55"
							/>
						</svg>
					</button>
					<div
						class={`video-preview-chrome video-preview-bottom-gradient pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 transition-all duration-220 md:p-4 ${inline_video_controls_visible ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0'}`}
					>
						<div
							class="video-preview-bottom-shell pointer-events-auto"
							role="presentation"
							data-comment-preview-control="true"
							data-video-preview-control="true"
							onpointerenter={() => set_inline_video_controls_region_active(true)}
							onpointermove={() => set_inline_video_controls_region_active(true)}
							onpointerleave={() => set_inline_video_controls_region_active(false)}
							onpointerup={release_inline_video_controls_region_for_touch}
							onpointercancel={release_inline_video_controls_region_for_touch}
						>
							<div class="video-preview-control-icons">
								<div class="video-preview-icon-stack">
									{#if inline_video_active_setting === 'brightness'}
										<div class="video-preview-setting-panel">
											<div class="video-preview-setting-track">
												<div
													class="video-preview-setting-fill"
													style={`height:${get_inline_video_setting_fill_percent('brightness')}%;`}
												></div>
												<span class="video-preview-setting-value">{inline_video_brightness}%</span>
											</div>
											<input
												type="range"
												min="40"
												max="160"
												step="1"
												value={inline_video_brightness}
												oninput={(event) => handle_inline_video_setting_input('brightness', event)}
												class="video-preview-setting-slider"
												aria-label="Adjust brightness"
											/>
										</div>
									{/if}
									<button
										type="button"
										data-comment-preview-control="true"
										data-video-preview-control="true"
										class="video-preview-icon-button"
										onclick={(event) => handle_inline_video_setting_click(event, 'brightness')}
										aria-pressed={inline_video_active_setting === 'brightness'}
										aria-label="Adjust brightness"
									>
										<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
											<circle
												cx="12"
												cy="12"
												r="3.2"
												fill="none"
												stroke="currentColor"
												stroke-width="1.8"
											/>
											<path
												d="M12 2.5v2.3M12 19.2v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
												fill="none"
												stroke="currentColor"
												stroke-linecap="round"
												stroke-width="1.8"
											/>
										</svg>
									</button>
								</div>
								<button
									type="button"
									data-comment-preview-control="true"
									data-video-preview-control="true"
									class="video-preview-icon-button"
									onclick={(event) => handle_inline_video_seek_click(event, -5)}
									aria-label="Go back 5 seconds"
								>
									<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
										<path
											d="M11.5 7 4.5 12l7 5V7ZM19.5 7l-7 5 7 5V7Z"
											fill="none"
											stroke="currentColor"
											stroke-linejoin="round"
											stroke-width="1.8"
										/>
									</svg>
								</button>
								<button
									type="button"
									data-comment-preview-control="true"
									data-video-preview-control="true"
									class="video-preview-icon-button video-preview-icon-button-play"
									onclick={handle_inline_video_playback_click}
									aria-label={inline_video_is_playing ? 'Pause video' : 'Play video'}
								>
									{#if inline_video_is_playing}
										<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
											<path d="M8.5 6.5h2.8v11H8.5zm4.2 0h2.8v11h-2.8z" fill="currentColor" />
										</svg>
									{:else}
										<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
											<path
												d="M8 6.2 17.5 12 8 17.8V6.2Z"
												fill="none"
												stroke="currentColor"
												stroke-linejoin="round"
												stroke-width="1.8"
											/>
										</svg>
									{/if}
								</button>
								<button
									type="button"
									data-comment-preview-control="true"
									data-video-preview-control="true"
									class="video-preview-icon-button"
									onclick={(event) => handle_inline_video_seek_click(event, 5)}
									aria-label="Go forward 5 seconds"
								>
									<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
										<path
											d="m12.5 7 7 5-7 5V7ZM4.5 7l7 5-7 5V7Z"
											fill="none"
											stroke="currentColor"
											stroke-linejoin="round"
											stroke-width="1.8"
										/>
									</svg>
								</button>
								<div class="video-preview-icon-stack">
									{#if inline_video_active_setting === 'volume'}
										<div class="video-preview-setting-panel">
											<div class="video-preview-setting-track">
												<div
													class="video-preview-setting-fill"
													style={`height:${get_inline_video_setting_fill_percent('volume')}%;`}
												></div>
												<span class="video-preview-setting-value">{inline_video_volume}%</span>
											</div>
											<input
												type="range"
												min="0"
												max="100"
												step="1"
												value={inline_video_volume}
												oninput={(event) => handle_inline_video_setting_input('volume', event)}
												class="video-preview-setting-slider"
												aria-label="Adjust volume"
											/>
										</div>
									{/if}
									<button
										type="button"
										data-comment-preview-control="true"
										data-video-preview-control="true"
										class="video-preview-icon-button"
										onclick={(event) => handle_inline_video_setting_click(event, 'volume')}
										aria-pressed={inline_video_active_setting === 'volume'}
										aria-label="Adjust volume"
									>
										<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
											<path
												d="M4.5 14.5h3.8l4.2 3.2V6.3L8.3 9.5H4.5z"
												fill="none"
												stroke="currentColor"
												stroke-linejoin="round"
												stroke-width="1.8"
											/>
											<path
												d="M16.2 9.2a4 4 0 0 1 0 5.6M18.8 6.8a7.3 7.3 0 0 1 0 10.4"
												fill="none"
												stroke="currentColor"
												stroke-linecap="round"
												stroke-width="1.8"
											/>
										</svg>
									</button>
								</div>
							</div>
							<div
								class="video-preview-track-column mt-4"
								style={`--video-preview-progress-ratio:${get_inline_video_seek_ratio()};`}
							>
								<div class="video-preview-time-row">
									<span class="video-preview-time"
										>{format_media_time(inline_video_current_time)}</span
									>
									<span class="video-preview-time">{format_media_time(inline_video_duration)}</span>
								</div>
								<div
									class="video-preview-slider-shell"
									role="presentation"
									data-comment-preview-control="true"
									data-video-preview-control="true"
									onpointerdown={begin_inline_video_seek_drag}
									onpointermove={move_inline_video_seek_drag}
									onpointerup={end_inline_video_seek_drag}
									onpointercancel={end_inline_video_seek_drag}
								>
									<div class="video-preview-slider-track" aria-hidden="true"></div>
									<div class="video-preview-slider-progress" aria-hidden="true"></div>
									<div class="video-preview-slider-thumb" aria-hidden="true"></div>
									<input
										type="range"
										min="0"
										max={Math.max(inline_video_duration, 0.1)}
										step="any"
										value={get_inline_video_seek_value()}
										oninput={handle_inline_video_seek}
										class="video-preview-slider w-full"
										aria-label="Seek video"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-white/20">
					<svg class="h-16 w-16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1 14H6l4-5 3 4 2-2.5 3 3.5z"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<!-- Right: Details -->
		<div
			class="flex min-h-0 flex-none flex-col border-t border-white/10 md:w-85 md:flex-none md:shrink-0 md:border-t-0 md:border-l lg:w-96"
		>
			<!-- Author header + post description + comments (scrollable) -->
			<div
				class="comment-detail-scroll min-h-0 flex-none overflow-visible pt-0 pr-3 pb-[calc(10.75rem+env(safe-area-inset-bottom))] pl-4 md:flex-1 md:overflow-x-hidden md:overflow-y-auto md:pb-4"
			>
				<div
					class="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-white/8 bg-[#0d0921]/92 px-4 py-3 backdrop-blur-md md:-mr-3"
				>
					<div class="flex min-w-0 flex-1 items-center gap-3">
						{#if post.author_avatar}
							<ProgressiveImage
								src={post.author_avatar}
								alt={post.author_name}
								wrapper_class="h-9 w-9 shrink-0 rounded-full"
								img_class="h-full w-full rounded-full object-cover"
								skeleton_class="rounded-full"
								loading="eager"
								decoding="async"
							/>
						{:else}
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
							>
								{post.author_name?.[0]?.toUpperCase() ?? '?'}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-white">{post.author_name}</p>
							<p class="truncate text-xs text-white/40">@{post.author_username}</p>
						</div>
					</div>
					<button
						type="button"
						onclick={on_close}
						data-comment-preview-control="true"
						class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rose-300/30 bg-[rgba(76,25,38,0.88)] text-base text-rose-100 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300/55 hover:bg-[rgba(190,24,93,0.52)] hover:text-white hover:shadow-[inset_0_0_18px_rgba(251,113,133,0.1),0_0_18px_rgba(251,113,133,0.18),0_12px_28px_rgba(0,0,0,0.22)] md:h-10 md:w-10 md:text-lg"
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
				{#if post.content}
					<p class="mt-4 text-sm leading-relaxed whitespace-pre-line text-white/80">
						{post.content}
					</p>
					<p class="mt-1 text-xs text-white/35">{time_ago(post.created_at)}</p>
				{/if}

				<div class="mt-4 border-t border-white/10 pt-4">
					<div class="mb-5 flex items-center justify-between">
						<p class="text-xs font-semibold tracking-wider text-white/35 uppercase">Comments</p>
						<span
							class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55"
						>
							{comment_count}
						</span>
					</div>
					{#if is_loading}
						<!-- Loading skeleton -->
						{#each [0, 1, 2] as i (i)}
							<div class="comment-card-shell mt-5">
								<div
									class="comment-card-container rounded-[1.35rem] border border-white/10 bg-white/7 px-5 py-4 pl-9"
								>
									<div
										class="comment-card-avatar z-10 animate-pulse rounded-full bg-white/10 ring-3 ring-[#0d0921]"
									></div>
									<div class="h-2.5 w-24 animate-pulse rounded bg-white/10"></div>
									<div class="mt-3 h-px bg-white/10"></div>
									<div class="mt-3 h-2.5 w-44 animate-pulse rounded bg-white/10"></div>
								</div>
							</div>
						{/each}
					{:else if comment_list.length === 0}
						<div class="flex flex-col items-center justify-center gap-2 py-8 text-center">
							<svg
								class="h-10 w-10 text-white/15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
								/>
							</svg>
							<p class="text-sm text-white/30">No comments yet</p>
							<p class="text-xs text-white/20">Be the first to comment</p>
						</div>
					{:else}
						<div class="flex flex-col gap-6">
							{#each comment_list as comment (comment.id)}
								<article
									class={`comment-card-shell transition duration-200 ${deleting_comment_id === comment.id ? 'pointer-events-none opacity-45 grayscale' : ''}`}
									data-comment-id={comment.id}
									aria-busy={deleting_comment_id === comment.id}
								>
									<div
										class="comment-card-container min-w-0 rounded-[1.1rem] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.055))] px-4 py-3 pl-9 shadow-[0_18px_45px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md sm:rounded-[1.35rem] sm:px-5 sm:py-4 sm:pl-10"
									>
										{#if comment.author_avatar}
											<ProgressiveImage
												src={comment.author_avatar}
												alt={comment.author_name}
												wrapper_class="comment-card-avatar z-10 shrink-0 rounded-full ring-3 ring-[#0d0921]"
												img_class="h-full w-full rounded-full object-cover"
												skeleton_class="rounded-full"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												class="comment-card-avatar z-10 flex shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-3 ring-[#0d0921]"
											>
												{comment.author_name?.[0]?.toUpperCase() ?? '?'}
											</div>
										{/if}
										<div class="flex flex-wrap items-start gap-3">
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-semibold text-white">
													{comment.author_name}
												</p>
												<p
													class="mt-0.5 text-[0.68rem] font-medium tracking-[0.12em] text-white/35 uppercase"
												>
													{time_ago(comment.created_at)}
												</p>
											</div>
											{#if comment.author_id === current_user_id}
												{#if confirm_delete_id === comment.id}
													<div class="flex shrink-0 items-center justify-end gap-1">
														<button
															type="button"
															onclick={() => handle_delete(comment.id)}
															disabled={deleting_comment_id === comment.id}
															class="rounded-full border border-rose-300/24 bg-red-500/18 px-2 py-1 text-[0.68rem] font-semibold text-red-100 shadow-[inset_0_0_14px_rgba(251,113,133,0.08),0_10px_22px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-rose-300/45 hover:bg-red-500/30 hover:text-white sm:px-3 sm:py-1.5 sm:text-xs"
														>
															{deleting_comment_id === comment.id ? 'Deleting...' : 'Delete'}
														</button>
														<button
															type="button"
															onclick={() => (confirm_delete_id = undefined)}
															disabled={deleting_comment_id === comment.id}
															class="rounded-full border border-white/12 bg-white/8 px-2 py-1 text-[0.68rem] font-semibold text-white/65 shadow-[0_10px_22px_rgba(0,0,0,0.14)] transition-all duration-200 hover:border-white/20 hover:bg-white/14 hover:text-white sm:px-3 sm:py-1.5 sm:text-xs"
														>
															Cancel
														</button>
													</div>
												{:else}
													<button
														type="button"
														onclick={() => (confirm_delete_id = comment.id)}
														class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rose-300/30 bg-[rgba(76,25,38,0.88)] text-rose-100 shadow-[inset_0_0_16px_rgba(251,113,133,0.06),0_10px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300/55 hover:bg-[rgba(190,24,93,0.52)] hover:text-white hover:shadow-[inset_0_0_18px_rgba(251,113,133,0.1),0_0_18px_rgba(251,113,133,0.18),0_12px_28px_rgba(0,0,0,0.22)]"
														aria-label="Delete comment"
													>
														<svg
															class="h-4 w-4"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<path d="M3 6h18" />
															<path d="M8 6V4h8v2" />
															<path d="M19 6l-1 14H6L5 6" />
															<path d="M10 11v5M14 11v5" />
														</svg>
													</button>
												{/if}
											{/if}
										</div>
										<div class="my-3 h-px bg-white/10"></div>
										<p class="text-sm leading-relaxed whitespace-pre-line text-white/80">
											{comment.content}
										</p>
									</div>
								</article>
							{/each}

							{#if has_more}
								<button
									type="button"
									onclick={load_more}
									disabled={is_loading_more}
									class="text-xs text-white/40 transition-colors hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{is_loading_more ? 'Loading…' : 'Load more comments'}
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Action bar + comment input -->
			<div
				class="fixed right-0 bottom-0 left-0 z-50 shrink-0 border-t border-white/10 bg-[#0d0921] px-4 pt-3 pb-[calc(1.65rem+env(safe-area-inset-bottom))] shadow-[0_-18px_36px_rgba(13,9,33,0.98)] md:static md:bg-transparent md:py-4 md:shadow-none"
			>
				<div class="flex items-center gap-4">
					<button
						type="button"
						class="group relative h-6 w-6 transition-opacity hover:opacity-70"
						onclick={on_like}
						aria-label={liked ? 'Unlike post' : 'Like post'}
					>
						<img
							src="/images/home-screen/unliked-state.avif"
							alt=""
							class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked
								? 'scale-75 opacity-0'
								: 'scale-100 opacity-100'}"
						/>
						<img
							src="/images/home-screen/liked-state.avif"
							alt="like"
							class="absolute inset-0 h-6 w-auto origin-center object-contain transition-all duration-250 ease-out {liked
								? 'scale-100 opacity-100'
								: 'scale-125 opacity-0'}"
						/>
					</button>
					<button
						type="button"
						class="flex items-center gap-1.5 transition-opacity hover:opacity-70"
					>
						<img src="/images/home-screen/comment-icon.avif" alt="comment" class="h-6 w-auto" />
						{#if comment_count > 0}
							<span class="text-xs font-medium text-white/60">{comment_count}</span>
						{/if}
					</button>
					<button type="button" class="transition-opacity hover:opacity-70">
						<img src="/images/home-screen/share-post-icon.avif" alt="share" class="h-6 w-auto" />
					</button>
				</div>

				<form
					class="mt-3 md:mt-4"
					onsubmit={(e) => {
						e.preventDefault();
						submit_comment();
					}}
				>
					<div
						class="flex items-center gap-2 rounded-full border border-white/16 bg-[linear-gradient(100deg,rgba(255,167,218,0.28),rgba(226,232,255,0.18)_48%,rgba(72,211,255,0.28))] p-1.5 shadow-[0_0_26px_rgba(205,130,255,0.18),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all duration-300 focus-within:border-sky-200/45 focus-within:shadow-[0_0_34px_rgba(125,212,255,0.25),inset_0_1px_0_rgba(255,255,255,0.28)] sm:gap-3"
					>
						<input
							type="text"
							placeholder="Add a comment..."
							bind:value={comment_input}
							maxlength={2000}
							disabled={is_submitting}
							class="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-sm font-medium text-white outline-none placeholder:text-white/48 disabled:opacity-60"
						/>
						<button
							type="submit"
							disabled={is_submitting || comment_input.trim().length === 0}
							class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#11164a] shadow-[0_10px_22px_rgba(0,0,0,0.32)] transition-all duration-250 hover:scale-105 hover:bg-[#17206a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.42)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:h-11 sm:w-11"
							aria-label={is_submitting ? 'Sending comment' : 'Send comment'}
						>
							<img
								src="/images/sidebar-and-search/open-messages.avif"
								alt=""
								class="h-5 w-5 object-contain"
							/>
						</button>
					</div>
					{#if submit_error}
						<p class="mt-1.5 text-xs text-red-400">{submit_error}</p>
					{/if}
				</form>
			</div>
		</div>
	</div>
</div>

<style>
	.comment-preview-panel {
		scroll-padding-top: 4.25rem;
		scroll-padding-bottom: calc(10.75rem + env(safe-area-inset-bottom, 0px));
	}

	.comment-card-shell {
		--comment-avatar-size: 3rem;
		position: relative;
		padding-top: calc(var(--comment-avatar-size) / 2);
		padding-left: calc(var(--comment-avatar-size) / 2);
	}

	.comment-card-container {
		position: relative;
	}

	:global(.comment-card-avatar) {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--comment-avatar-size);
		height: var(--comment-avatar-size);
		transform: translate(-50%, -50%);
	}

	.comment-detail-scroll {
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: rgba(205, 130, 255, 0.8) rgba(255, 255, 255, 0.04);
	}

	.comment-detail-scroll::-webkit-scrollbar {
		width: 0.9rem;
	}

	.comment-detail-scroll::-webkit-scrollbar-track {
		margin-block: 0.75rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}

	.comment-detail-scroll::-webkit-scrollbar-thumb {
		border: 0.28rem solid transparent;
		border-radius: 999px;
		background: linear-gradient(180deg, rgba(255, 167, 218, 0.95), rgba(125, 212, 255, 0.92))
			padding-box;
		box-shadow: 0 0 18px rgba(205, 130, 255, 0.32);
	}

	.comment-detail-scroll::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(180deg, rgba(255, 193, 229, 1), rgba(151, 224, 255, 1)) padding-box;
	}

	.comment-inline-video {
		touch-action: none;
		overscroll-behavior: contain;
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.comment-video-expand-button {
		display: grid;
		width: 2.85rem;
		height: 2.85rem;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 9999px;
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.07)),
			rgba(5, 8, 18, 0.64);
		box-shadow:
			0 18px 40px rgba(0, 0, 0, 0.26),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
		color: rgba(247, 251, 255, 0.96);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			background 0.18s ease,
			box-shadow 0.18s ease;
	}

	.comment-video-expand-button:hover,
	.comment-video-expand-button:focus-visible {
		border-color: rgba(125, 212, 255, 0.58);
		background:
			linear-gradient(135deg, rgba(125, 212, 255, 0.28), rgba(255, 255, 255, 0.1)),
			rgba(7, 12, 26, 0.72);
		box-shadow:
			0 0 0 1px rgba(125, 212, 255, 0.16),
			0 18px 42px rgba(0, 0, 0, 0.3),
			0 0 26px rgba(125, 212, 255, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
		transform: translateY(-1px) scale(1.03);
		outline: none;
	}

	.comment-video-expand-button:active {
		transform: translateY(0) scale(0.98);
	}

	.comment-video-expand-svg {
		width: 1.45rem;
		height: 1.45rem;
	}

	@media (max-width: 767px) {
		.comment-inline-video .video-preview-gesture-setting-panel {
			width: 1.35rem;
			height: min(30dvh, 11.5rem);
		}

		.comment-inline-video .video-preview-gesture-setting-panel .video-preview-setting-track {
			border-radius: 0.6rem;
		}

		.comment-inline-video .video-preview-gesture-setting-panel .video-preview-setting-value {
			font-size: 0.58rem;
			letter-spacing: 0.02em;
		}

		.comment-inline-video .video-preview-gesture-setting-icon {
			bottom: 0.4rem;
			width: 0.78rem;
			height: 0.78rem;
		}
	}

	.comment-inline-video .video-preview-gesture-setting-panel .video-preview-setting-track {
		isolation: isolate;
	}

	.comment-inline-video .video-preview-gesture-setting-panel .video-preview-setting-fill {
		z-index: 1;
	}

	.comment-inline-video .video-preview-gesture-setting-panel .video-preview-setting-value {
		z-index: 2;
	}

	.comment-inline-video .video-preview-gesture-setting-icon {
		top: auto;
		right: auto;
		bottom: 0.52rem;
		left: 50%;
		z-index: 6;
		pointer-events: none;
		transform: translateX(-50%);
	}

	@media (max-width: 767px) {
		.comment-inline-video .video-preview-gesture-setting-icon {
			bottom: 0.36rem;
		}
	}

	.comment-inline-video-media {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
</style>
