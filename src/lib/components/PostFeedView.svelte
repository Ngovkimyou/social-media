<script lang="ts">
	import './post-feed-view.css';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';
	import { onDestroy, onMount, tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { fade, scale } from 'svelte/transition';
	import {
		get_last_home_feed_state,
		set_last_home_feed_state,
		type HomeFeedState
	} from '$lib/state/home-feed-state';
	import type { PostFeedPost } from '$lib/types/post-feed';
	import PostDetailModal from '$lib/components/PostDetailModal.svelte';

	type BackPath = '/profile' | `/profile/${string}`;
	type PostPath = `/profile/${string}/posts/${string}` | `/profile/${string}/shared/${string}`;
	const last_home_state_storage_key = 'post-feed-last-home-state';

	type Props = {
		posts: PostFeedPost[];
		title: string;
		subtitle?: string;
		back_path?: BackPath;
		get_post_path?: ((post: PostFeedPost) => PostPath) | undefined;
		has_more?: boolean;
		is_loading_more?: boolean;
		load_more_error?: string;
		on_load_more?: (() => Promise<void> | void) | undefined;
		current_user_id?: string;
	};

	const {
		posts,
		title,
		subtitle,
		back_path,
		get_post_path,
		has_more = false,
		is_loading_more = false,
		load_more_error = '',
		on_load_more,
		current_user_id = ''
	}: Props = $props();

	const requested_view = $derived(page.url.searchParams.get('view') === 'grid' ? 'grid' : 'feed');
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const isGridView = $derived(requested_view === 'grid');
	let expanded_captions = $state<Record<string, boolean>>({});
	let overflowing_captions = $state<Record<string, boolean>>({});
	let root_container = $state<HTMLDivElement | undefined>();
	let scroll_container = $state<HTMLDivElement | undefined>();
	let mounted_scroll_storage_key = $state('');
	let video_preview_backdrop = $state<HTMLDivElement | undefined>();
	let video_preview_element = $state<HTMLVideoElement | undefined>();
	let load_more_sentinel = $state<HTMLDivElement | undefined>();
	let detail_post = $state<PostFeedPost | undefined>();
	let video_preview = $state<
		| {
				src: string;
				alt: string;
		  }
		| undefined
	>();
	let video_preview_current_time = $state(0);
	let video_preview_duration = $state(0);
	let video_preview_is_playing = $state(false);
	let video_preview_is_buffering = $state(false);
	let video_preview_volume = $state(100);
	let video_preview_brightness = $state(100);
	let active_video_preview_panel = $state<'brightness' | 'volume' | undefined>();
	let video_preview_controls_visible = $state(true);
	let video_preview_controls_region_active = $state(false);
	let is_compact_video_preview = $state(false);
	let video_preview_controls_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let video_preview_click_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let video_preview_time_frame = $state<number | undefined>();
	let video_preview_seek_pointer_id = $state<number | undefined>();
	let video_preview_seek_grab_offset_x = $state(0);
	let video_preview_drag_offset_x = $state(0);
	let video_preview_drag_offset_y = $state(0);
	let video_preview_should_ignore_next_click = $state(false);
	let video_preview_touch_setting_panel = $state<'brightness' | 'volume' | undefined>();
	let video_preview_setting_drag_state = $state<
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
	let video_preview_drag_hold_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let video_preview_drag_pending_state = $state<
		| {
				pointer_id: number;
				start_x: number;
				start_y: number;
				target: HTMLElement;
		  }
		| undefined
	>();
	let video_preview_drag_state = $state<
		| {
				pointer_id: number;
				start_x: number;
				start_y: number;
		  }
		| undefined
	>();
	let scroll_measure_frame = $state<number | undefined>();
	let scroll_persist_timeout = $state<ReturnType<typeof setTimeout> | undefined>();
	let load_more_observer = $state<IntersectionObserver | undefined>();
	let skip_next_scroll_restore = $state(false);
	let liked_posts = $state<Record<string, boolean>>({});
	let like_counts = $state<Record<string, number>>({});
	let confirmed_liked_posts = $state<Record<string, boolean>>({});
	let confirmed_like_counts = $state<Record<string, number>>({});
	let like_requests_in_flight = $state<Record<string, boolean>>({});
	let shared_posts = $state<Record<string, boolean>>({});
	let share_counts = $state<Record<string, number>>({});
	let confirmed_shared_posts = $state<Record<string, boolean>>({});
	let confirmed_share_counts = $state<Record<string, number>>({});
	let share_requests_in_flight = $state<Record<string, boolean>>({});
	let loaded_images = $state<Record<string, boolean>>({});
	let unavailable_media = $state<Record<string, boolean>>({});
	let comment_counts = $state<Record<string, number>>({});
	let hidden_post_ids = $state<Record<string, boolean>>({});
	let open_post_actions_menu_id = $state<string | undefined>();
	let deleting_post_id = $state<string | undefined>();
	let hiding_post_id = $state<string | undefined>();
	let post_delete_error = $state('');
	// eslint-disable-next-line @typescript-eslint/naming-convention
	let hasConsumedFocusPost = $state(false);
	const post_elements = new SvelteMap<string, HTMLElement>();
	const prewarmed_media_urls = new SvelteSet<string>();
	const current_return_to = $derived(`${page.url.pathname}${page.url.search}${page.url.hash}`);
	const focus_post_id = $derived(page.url.searchParams.get('focusPost')?.trim() ?? '');
	const visible_posts = $derived(posts.filter((post) => !hidden_post_ids[post.id]));
	const has_infinite_feed = $derived(Boolean(on_load_more));
	const grid_loading_placeholders = Array.from({ length: 6 }, (_, index) => index);
	const video_preview_controls_hide_delay_ms = 1000;
	const video_preview_mobile_tap_controls_hide_delay_ms = 5000;
	const video_preview_start_display_snap_seconds = 0.05;
	const video_preview_end_display_snap_seconds = 0.05;
	const video_preview_drag_click_suppression_distance = 12;
	const video_preview_setting_drag_sensitivity = 0.65;
	const video_preview_drag_hold_delay_ms = 260;
	const video_preview_close_drag_distance = 110;
	const post_action_sync_delay_ms = 320;
	const like_sync_timeouts = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	const share_sync_timeouts = new SvelteMap<string, ReturnType<typeof setTimeout>>();

	function caption_key(view: 'grid' | 'feed', post_id: string | number) {
		return `${view}-${String(post_id)}`;
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

	function toggle_caption(caption_id: string) {
		expanded_captions = {
			...expanded_captions,
			[caption_id]: !expanded_captions[caption_id]
		};
	}

	function set_caption_overflow(caption_id: string, is_overflowing: boolean) {
		if (overflowing_captions[caption_id] === is_overflowing) {
			return;
		}

		overflowing_captions = {
			...overflowing_captions,
			[caption_id]: is_overflowing
		};
	}

	function measure_caption(node: HTMLElement, caption_id: string): { destroy(): void } {
		const max_preview_lines = 3;
		let measure_frame: number | undefined;
		let is_destroyed = false;

		const measure_natural_line_count = () => {
			const node_width = node.getBoundingClientRect().width;

			if (node_width <= 0) {
				return 0;
			}

			const computed_style = getComputedStyle(node);
			const line_height = Number.parseFloat(computed_style.lineHeight);
			const font_size = Number.parseFloat(computed_style.fontSize);
			const resolved_line_height = Number.isFinite(line_height) ? line_height : font_size * 1.2;
			const clone = node.cloneNode(true) as HTMLElement;

			clone.classList.remove('caption-preview');
			clone.style.position = 'absolute';
			clone.style.visibility = 'hidden';
			clone.style.pointerEvents = 'none';
			clone.style.inset = 'auto';
			clone.style.width = `${node_width}px`;
			clone.style.height = 'auto';
			clone.style.maxHeight = 'none';
			clone.style.overflow = 'visible';
			clone.style.display = 'block';
			clone.style.setProperty('line-clamp', 'unset');
			clone.style.setProperty('-webkit-line-clamp', 'unset');
			clone.style.setProperty('-webkit-box-orient', 'unset');

			document.body.append(clone);
			const natural_height = clone.getBoundingClientRect().height;
			clone.remove();

			return natural_height / resolved_line_height;
		};

		const update = () => {
			measure_frame = undefined;
			set_caption_overflow(caption_id, measure_natural_line_count() > max_preview_lines + 0.2);
		};

		const schedule_update = () => {
			if (measure_frame !== undefined) {
				cancelAnimationFrame(measure_frame);
			}

			measure_frame = requestAnimationFrame(update);
		};

		const resize_observer = new ResizeObserver(() => {
			schedule_update();
		});

		resize_observer.observe(node);
		schedule_update();
		void document.fonts?.ready.then(() => {
			if (!is_destroyed) {
				schedule_update();
			}
		});

		return {
			destroy() {
				is_destroyed = true;
				if (measure_frame !== undefined) {
					cancelAnimationFrame(measure_frame);
				}
				resize_observer.disconnect();
			}
		};
	}

	function register_post_element(node: HTMLElement, post_id: string): { destroy(): void } {
		node.dataset['postId'] = post_id;
		post_elements.set(post_id, node);

		return {
			destroy() {
				delete node.dataset['postId'];
				post_elements.delete(post_id);
			}
		};
	}

	function get_active_scroll_container() {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
			return scroll_container;
		}

		return root_container;
	}

	function open_post_detail(post: PostFeedPost) {
		detail_post = post;
	}

	function close_post_detail() {
		detail_post = undefined;
	}

	function get_post_comment_count(post: PostFeedPost) {
		return comment_counts[String(post.id)] ?? post.comment_count;
	}

	function handle_post_comment_count_change(post_id: string | number, next_count: number) {
		const key = String(post_id);
		comment_counts = {
			...comment_counts,
			[key]: next_count
		};

		if (detail_post?.id === post_id) {
			detail_post = {
				...detail_post,
				comment_count: next_count
			};
		}
	}

	function can_delete_post(post: PostFeedPost) {
		return Boolean(current_user_id) && post.author_id === current_user_id;
	}

	function can_hide_post(post: PostFeedPost) {
		return (
			Boolean(current_user_id) &&
			!can_delete_post(post) &&
			(page.url.pathname === '/home' || /^\/profile\/[^/]+\/shared\/[^/]+$/.test(page.url.pathname))
		);
	}

	function toggle_post_actions_menu(post_id: string | number) {
		const key = String(post_id);
		post_delete_error = '';
		open_post_actions_menu_id = open_post_actions_menu_id === key ? undefined : key;
	}

	async function delete_post_from_feed(post: PostFeedPost) {
		if (!can_delete_post(post) || deleting_post_id) {
			return;
		}

		const key = String(post.id);
		deleting_post_id = key;
		post_delete_error = '';

		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(key)}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(payload.error ?? 'Unable to delete post right now.');
			}

			hidden_post_ids = {
				...hidden_post_ids,
				[key]: true
			};
			open_post_actions_menu_id = undefined;

			if (detail_post?.id === post.id) {
				detail_post = undefined;
			}
		} catch (error) {
			post_delete_error =
				error instanceof Error ? error.message : 'Unable to delete post right now.';
		} finally {
			deleting_post_id = undefined;
		}
	}

	async function hide_post_from_home_feed(post: PostFeedPost) {
		if (!can_hide_post(post) || hiding_post_id) {
			return;
		}

		const key = String(post.id);
		hiding_post_id = key;
		post_delete_error = '';

		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(key)}/hide`, {
				method: 'POST'
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(payload.error ?? 'Unable to hide post right now.');
			}

			hidden_post_ids = {
				...hidden_post_ids,
				[key]: true
			};
			open_post_actions_menu_id = undefined;

			if (detail_post?.id === post.id) {
				detail_post = undefined;
			}
		} catch (error) {
			post_delete_error = error instanceof Error ? error.message : 'Unable to hide post right now.';
		} finally {
			hiding_post_id = undefined;
		}
	}

	function format_media_time(seconds: number) {
		const normalized = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(normalized / 60);
		const remaining_seconds = normalized % 60;

		return `${minutes}:${String(remaining_seconds).padStart(2, '0')}`;
	}

	function sync_video_preview_viewport() {
		if (typeof window === 'undefined') {
			return;
		}

		is_compact_video_preview = window.matchMedia('(max-width: 767px)').matches;
	}

	function clear_video_preview_controls_timeout() {
		if (!video_preview_controls_timeout) {
			return;
		}

		clearTimeout(video_preview_controls_timeout);
		video_preview_controls_timeout = undefined;
	}

	function schedule_video_preview_controls_hide(delay_ms = video_preview_controls_hide_delay_ms) {
		clear_video_preview_controls_timeout();

		if (!video_preview || video_preview_controls_region_active) {
			return;
		}

		video_preview_controls_timeout = setTimeout(() => {
			video_preview_controls_timeout = undefined;

			if (video_preview_controls_region_active) {
				return;
			}

			video_preview_controls_visible = false;
		}, delay_ms);
	}

	function show_video_preview_controls() {
		video_preview_controls_visible = true;
		schedule_video_preview_controls_hide();
	}

	function toggle_video_preview_controls() {
		clear_video_preview_controls_timeout();
		video_preview_controls_region_active = false;

		if (video_preview_controls_visible) {
			video_preview_controls_visible = false;
			return;
		}

		video_preview_controls_visible = true;
		schedule_video_preview_controls_hide(
			is_compact_video_preview
				? video_preview_mobile_tap_controls_hide_delay_ms
				: video_preview_controls_hide_delay_ms
		);
	}

	function set_video_preview_controls_region_active(is_active: boolean) {
		video_preview_controls_region_active = is_active;

		if (is_active) {
			video_preview_controls_visible = true;
			clear_video_preview_controls_timeout();
			return;
		}

		schedule_video_preview_controls_hide();
	}

	function release_video_preview_controls_region_for_touch(event: PointerEvent) {
		if (event.pointerType === 'mouse') {
			return;
		}

		set_video_preview_controls_region_active(false);
	}

	function clear_video_preview_click_timeout() {
		if (!video_preview_click_timeout) {
			return;
		}

		clearTimeout(video_preview_click_timeout);
		video_preview_click_timeout = undefined;
	}

	function clear_video_preview_drag_hold() {
		if (video_preview_drag_hold_timeout) {
			clearTimeout(video_preview_drag_hold_timeout);
			video_preview_drag_hold_timeout = undefined;
		}

		video_preview_drag_pending_state = undefined;
	}

	function apply_video_preview_media_settings() {
		if (!video_preview_element) {
			return;
		}

		video_preview_element.volume = Math.max(0, Math.min(video_preview_volume / 100, 1));
	}

	function stop_video_preview_time_loop() {
		if (video_preview_time_frame === undefined) {
			return;
		}

		cancelAnimationFrame(video_preview_time_frame);
		video_preview_time_frame = undefined;
	}

	function sync_video_preview_time_from_element() {
		if (!video_preview_element) {
			return;
		}

		const next_duration = Number.isFinite(video_preview_element.duration)
			? video_preview_element.duration
			: 0;
		const next_current_time =
			next_duration > 0 && next_duration - video_preview_element.currentTime <= 0.05
				? next_duration
				: video_preview_element.currentTime;

		video_preview_current_time = next_current_time;
		video_preview_duration = next_duration;
		video_preview_is_playing = !video_preview_element.paused;
	}

	function start_video_preview_time_loop() {
		if (video_preview_time_frame !== undefined || typeof window === 'undefined') {
			return;
		}

		const update = () => {
			sync_video_preview_time_from_element();

			if (!video_preview_element || video_preview_element.paused || video_preview_element.ended) {
				video_preview_time_frame = undefined;
				return;
			}

			video_preview_time_frame = requestAnimationFrame(update);
		};

		video_preview_time_frame = requestAnimationFrame(update);
	}

	function get_video_preview_seek_value() {
		if (video_preview_duration <= 0) {
			return 0;
		}

		const clamped_current_time = Math.min(video_preview_current_time, video_preview_duration);
		const remaining = video_preview_duration - clamped_current_time;

		if (clamped_current_time < video_preview_start_display_snap_seconds) {
			return 0;
		}

		if (remaining <= video_preview_end_display_snap_seconds) {
			return video_preview_duration;
		}

		return clamped_current_time;
	}

	function get_video_preview_seek_percent() {
		if (video_preview_duration <= 0) {
			return 0;
		}

		return Math.max(
			0,
			Math.min((get_video_preview_seek_value() / video_preview_duration) * 100, 100)
		);
	}

	function get_video_preview_seek_ratio() {
		return get_video_preview_seek_percent() / 100;
	}

	function open_video_preview(src: string, alt: string) {
		video_preview = { src, alt };
		video_preview_current_time = 0;
		video_preview_duration = 0;
		video_preview_is_playing = false;
		video_preview_is_buffering = true;
		video_preview_volume = 100;
		video_preview_brightness = 100;
		active_video_preview_panel = undefined;
		video_preview_touch_setting_panel = undefined;
		video_preview_setting_drag_state = undefined;
		video_preview_controls_visible = true;
		video_preview_controls_region_active = false;
		video_preview_drag_offset_x = 0;
		video_preview_drag_offset_y = 0;
		video_preview_should_ignore_next_click = false;
		clear_video_preview_drag_hold();
		video_preview_drag_state = undefined;
		video_preview_seek_pointer_id = undefined;
		video_preview_seek_grab_offset_x = 0;
		sync_video_preview_viewport();
		schedule_video_preview_controls_hide();

		void tick().then(() => {
			if (video_preview?.src !== src || !video_preview_element) {
				return;
			}

			void video_preview_element.play().catch(() => {
				video_preview_is_playing = false;
			});
		});
	}

	function close_video_preview() {
		video_preview_element?.pause();
		stop_video_preview_time_loop();
		clear_video_preview_controls_timeout();
		clear_video_preview_click_timeout();
		clear_video_preview_drag_hold();
		video_preview = undefined;
		video_preview_is_playing = false;
		video_preview_is_buffering = false;
		video_preview_current_time = 0;
		video_preview_duration = 0;
		active_video_preview_panel = undefined;
		video_preview_touch_setting_panel = undefined;
		video_preview_setting_drag_state = undefined;
		video_preview_controls_visible = true;
		video_preview_controls_region_active = false;
		video_preview_drag_offset_x = 0;
		video_preview_drag_offset_y = 0;
		video_preview_should_ignore_next_click = false;
		video_preview_drag_state = undefined;
		video_preview_seek_pointer_id = undefined;
		video_preview_seek_grab_offset_x = 0;
	}

	function sync_video_preview_time(event: Event) {
		const video = event.currentTarget as HTMLVideoElement;
		apply_video_preview_media_settings();
		sync_video_preview_time_from_element();
		video_preview_is_buffering = false;

		if (video.paused) {
			stop_video_preview_time_loop();
			return;
		}

		start_video_preview_time_loop();
	}

	function show_video_preview_buffering() {
		if (!video_preview) {
			return;
		}

		video_preview_is_buffering = true;
	}

	function hide_video_preview_buffering() {
		video_preview_is_buffering = false;
		sync_video_preview_time_from_element();
	}

	function toggle_video_preview_playback(options?: { force?: 'play' | 'pause' }) {
		if (!video_preview_element) {
			return;
		}

		const next_action = options?.force ?? (video_preview_element.paused ? 'play' : 'pause');

		if (next_action === 'play') {
			void video_preview_element.play();
			return;
		}

		video_preview_element.pause();
	}

	function seek_video_preview(delta_seconds: number) {
		if (!video_preview_element) {
			return;
		}

		const current_seek_value = get_video_preview_seek_value();
		const duration = video_preview_element.duration || video_preview_duration || 0;

		if (delta_seconds < 0 && current_seek_value <= 0) {
			video_preview_element.currentTime = 0;
			video_preview_current_time = 0;
			video_preview_seek_grab_offset_x = 0;
			return;
		}

		if (delta_seconds > 0 && duration > 0 && current_seek_value >= duration) {
			video_preview_element.currentTime = duration;
			video_preview_current_time = duration;
			video_preview_seek_grab_offset_x = 0;
			return;
		}

		const next_time = Math.max(
			0,
			Math.min(video_preview_element.currentTime + delta_seconds, duration)
		);
		video_preview_element.currentTime = next_time;
		video_preview_current_time = next_time;
	}

	function seek_video_preview_to_time(next_time: number) {
		if (!video_preview_element) {
			return;
		}

		const duration = video_preview_element.duration || video_preview_duration || 0;
		const clamped_time = Math.max(0, Math.min(next_time, duration));
		video_preview_element.currentTime = clamped_time;
		video_preview_current_time = clamped_time;
		video_preview_duration = Number.isFinite(video_preview_element.duration)
			? video_preview_element.duration
			: video_preview_duration;
		show_video_preview_controls();
	}

	function seek_video_preview_from_pointer(event: PointerEvent) {
		if (!video_preview_element || video_preview_duration <= 0) {
			return;
		}

		const slider = event.currentTarget as HTMLElement;
		const bounds = slider.getBoundingClientRect();
		const adjusted_x = event.clientX - video_preview_seek_grab_offset_x;
		const ratio = Math.max(0, Math.min((adjusted_x - bounds.left) / bounds.width, 1));
		const next_time = ratio * video_preview_duration;
		seek_video_preview_to_time(
			next_time <= video_preview_start_display_snap_seconds ? 0 : next_time
		);
	}

	function begin_video_preview_seek_drag(event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
		active_video_preview_panel = undefined;
		video_preview_seek_pointer_id = event.pointerId;
		const slider = event.currentTarget as HTMLElement;
		const bounds = slider.getBoundingClientRect();
		const thumb_center_x = bounds.left + get_video_preview_seek_ratio() * bounds.width;
		const thumb_radius = bounds.height / 2;
		video_preview_seek_grab_offset_x =
			Math.abs(event.clientX - thumb_center_x) <= thumb_radius * 1.35
				? event.clientX - thumb_center_x
				: 0;
		slider.setPointerCapture(event.pointerId);
		seek_video_preview_from_pointer(event);
	}

	function move_video_preview_seek_drag(event: PointerEvent) {
		if (video_preview_seek_pointer_id !== event.pointerId) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		seek_video_preview_from_pointer(event);
	}

	function end_video_preview_seek_drag(event: PointerEvent) {
		if (video_preview_seek_pointer_id !== event.pointerId) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		video_preview_seek_pointer_id = undefined;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		seek_video_preview_from_pointer(event);
		video_preview_seek_grab_offset_x = 0;
	}

	function handle_video_preview_seek(event: Event) {
		if (!video_preview_element) {
			return;
		}

		const next_time = Number((event.currentTarget as HTMLInputElement).value);
		seek_video_preview_to_time(next_time);
	}

	function handle_video_preview_pointer_move(event: PointerEvent) {
		move_video_preview_drag(event);
	}

	function handle_video_preview_stage_click(event: Event) {
		if ((event.target as HTMLElement | null)?.closest('[data-video-preview-control="true"]')) {
			return;
		}

		if (video_preview_should_ignore_next_click) {
			video_preview_should_ignore_next_click = false;
			clear_video_preview_click_timeout();
			return;
		}

		active_video_preview_panel = undefined;
		clear_video_preview_click_timeout();
		video_preview_click_timeout = setTimeout(() => {
			if (is_compact_video_preview) {
				toggle_video_preview_controls();
				video_preview_click_timeout = undefined;
				return;
			}

			toggle_video_preview_playback();
			video_preview_click_timeout = undefined;
		}, 220);
	}

	function get_video_preview_display_bounds() {
		if (!video_preview_element) {
			return;
		}

		const bounds = video_preview_element.getBoundingClientRect();
		const media_width = video_preview_element.videoWidth;
		const media_height = video_preview_element.videoHeight;

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

	function get_video_preview_setting_panel_from_point(event: PointerEvent) {
		const media_bounds = get_video_preview_display_bounds();

		if (!media_bounds) {
			return;
		}

		const is_inside_media =
			event.clientX >= media_bounds.left &&
			event.clientX <= media_bounds.right &&
			event.clientY >= media_bounds.top &&
			event.clientY <= media_bounds.bottom;

		if (!is_inside_media) {
			return;
		}

		return event.clientX < media_bounds.left + media_bounds.width / 2 ? 'brightness' : 'volume';
	}

	function update_video_preview_setting_from_drag(event: PointerEvent) {
		if (!video_preview_setting_drag_state) {
			return;
		}

		const delta_y = video_preview_setting_drag_state.start_y - event.clientY;
		const next_value =
			video_preview_setting_drag_state.start_value +
			delta_y * video_preview_setting_drag_sensitivity;

		if (video_preview_setting_drag_state.panel === 'brightness') {
			video_preview_brightness = Math.round(Math.max(40, Math.min(next_value, 160)));
			return;
		}

		video_preview_volume = Math.round(Math.max(0, Math.min(next_value, 100)));
		apply_video_preview_media_settings();
	}

	function handle_video_preview_stage_double_click(event: MouseEvent) {
		if ((event.target as HTMLElement | null)?.closest('[data-video-preview-control="true"]')) {
			return;
		}

		clear_video_preview_click_timeout();

		if (is_compact_video_preview) {
			const media_bounds = get_video_preview_display_bounds();

			if (!media_bounds) {
				return;
			}

			const is_inside_media =
				event.clientX >= media_bounds.left &&
				event.clientX <= media_bounds.right &&
				event.clientY >= media_bounds.top &&
				event.clientY <= media_bounds.bottom;

			if (!is_inside_media) {
				return;
			}

			seek_video_preview(event.clientX < media_bounds.left + media_bounds.width / 2 ? -5 : 5);
			return;
		}

		if (!(event.currentTarget instanceof HTMLElement)) {
			return;
		}

		const bounds = event.currentTarget.getBoundingClientRect();
		const relative_x = event.clientX - bounds.left;

		if (relative_x < bounds.width * 0.35) {
			seek_video_preview(-5);
			return;
		}

		if (relative_x > bounds.width * 0.65) {
			seek_video_preview(5);
			return;
		}

		toggle_video_preview_playback();
	}

	function handle_video_preview_keydown(event: KeyboardEvent) {
		if (!video_preview) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			if (active_video_preview_panel) {
				active_video_preview_panel = undefined;
				return;
			}
			close_video_preview();
			return;
		}

		if (event.key === ' ' || event.key.toLowerCase() === 'k') {
			event.preventDefault();
			toggle_video_preview_playback();
			return;
		}

		if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'j') {
			event.preventDefault();
			seek_video_preview(-5);
			return;
		}

		if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'l') {
			event.preventDefault();
			seek_video_preview(5);
		}
	}

	function toggle_video_preview_panel(panel: 'brightness' | 'volume') {
		active_video_preview_panel = active_video_preview_panel === panel ? undefined : panel;
		show_video_preview_controls();
	}

	function handle_video_preview_volume_input(event: Event) {
		video_preview_volume = Number((event.currentTarget as HTMLInputElement).value);
		apply_video_preview_media_settings();
		show_video_preview_controls();
	}

	function handle_video_preview_brightness_input(event: Event) {
		video_preview_brightness = Number((event.currentTarget as HTMLInputElement).value);
		show_video_preview_controls();
	}

	function handle_video_preview_ended(event: Event) {
		const video = event.currentTarget as HTMLVideoElement;
		stop_video_preview_time_loop();
		video_preview_current_time = Number.isFinite(video.duration)
			? video.duration
			: video.currentTime;
		video_preview_duration = Number.isFinite(video.duration)
			? video.duration
			: video_preview_duration;
		video_preview_is_playing = false;
		video_preview_is_buffering = false;
	}

	function get_video_preview_setting_fill_percent(panel: 'brightness' | 'volume') {
		if (panel === 'brightness') {
			return ((video_preview_brightness - 40) / (160 - 40)) * 100;
		}

		return video_preview_volume;
	}

	function begin_video_preview_drag(event: PointerEvent) {
		if ((event.target as HTMLElement | null)?.closest('[data-video-preview-control="true"]')) {
			return;
		}

		video_preview_should_ignore_next_click = false;
		const setting_panel = get_video_preview_setting_panel_from_point(event);
		if (setting_panel) {
			video_preview_setting_drag_state = {
				has_moved: false,
				panel: setting_panel,
				pointer_id: event.pointerId,
				start_value:
					setting_panel === 'brightness' ? video_preview_brightness : video_preview_volume,
				start_x: event.clientX,
				start_y: event.clientY,
				target: event.currentTarget as HTMLElement
			};
		}

		if (!is_compact_video_preview) {
			return;
		}

		clear_video_preview_drag_hold();
		video_preview_drag_pending_state = {
			pointer_id: event.pointerId,
			start_x: event.clientX,
			start_y: event.clientY,
			target: event.currentTarget as HTMLElement
		};

		video_preview_drag_hold_timeout = setTimeout(() => {
			const pending_state = video_preview_drag_pending_state;
			video_preview_drag_hold_timeout = undefined;

			if (!pending_state || pending_state.pointer_id !== event.pointerId) {
				return;
			}

			video_preview_should_ignore_next_click = true;
			video_preview_setting_drag_state = undefined;
			video_preview_touch_setting_panel = undefined;
			video_preview_drag_state = {
				pointer_id: pending_state.pointer_id,
				start_x: pending_state.start_x,
				start_y: pending_state.start_y
			};
			video_preview_drag_pending_state = undefined;
			pending_state.target.setPointerCapture(pending_state.pointer_id);
		}, video_preview_drag_hold_delay_ms);
	}

	function start_video_preview_setting_drag(event: PointerEvent) {
		const setting_drag_state = video_preview_setting_drag_state;

		if (!setting_drag_state || setting_drag_state.pointer_id !== event.pointerId) {
			return false;
		}

		if (setting_drag_state.has_moved) {
			return true;
		}

		const horizontal_distance = Math.abs(event.clientX - setting_drag_state.start_x);
		const vertical_distance = Math.abs(event.clientY - setting_drag_state.start_y);

		if (
			vertical_distance <= video_preview_drag_click_suppression_distance ||
			vertical_distance <= horizontal_distance
		) {
			return false;
		}

		setting_drag_state.has_moved = true;
		video_preview_touch_setting_panel = setting_drag_state.panel;
		active_video_preview_panel = undefined;
		video_preview_controls_visible = false;
		video_preview_should_ignore_next_click = true;
		clear_video_preview_click_timeout();
		clear_video_preview_controls_timeout();
		clear_video_preview_drag_hold();
		setting_drag_state.target.setPointerCapture(event.pointerId);

		return true;
	}

	function move_video_preview_setting_drag(event: PointerEvent) {
		if (!start_video_preview_setting_drag(event)) {
			return false;
		}

		event.preventDefault();
		event.stopPropagation();
		update_video_preview_setting_from_drag(event);

		return true;
	}

	function clear_pending_video_preview_drag_after_move(event: PointerEvent) {
		const pending_state = video_preview_drag_pending_state;

		if (!pending_state || pending_state.pointer_id !== event.pointerId) {
			return;
		}

		const pending_distance = Math.hypot(
			event.clientX - pending_state.start_x,
			event.clientY - pending_state.start_y
		);

		if (pending_distance > video_preview_drag_click_suppression_distance) {
			clear_video_preview_drag_hold();
		}
	}

	function release_video_preview_setting_drag_capture(event: PointerEvent) {
		const setting_drag_state = video_preview_setting_drag_state;

		if (!setting_drag_state?.has_moved) {
			return;
		}

		if (setting_drag_state.target.hasPointerCapture(event.pointerId)) {
			setting_drag_state.target.releasePointerCapture(event.pointerId);
		}
	}

	function clear_video_preview_setting_drag() {
		video_preview_setting_drag_state = undefined;
		video_preview_touch_setting_panel = undefined;
	}

	function move_video_preview_drag(event: PointerEvent) {
		if (move_video_preview_setting_drag(event)) {
			return;
		}

		clear_pending_video_preview_drag_after_move(event);

		if (!video_preview_drag_state || video_preview_drag_state.pointer_id !== event.pointerId) {
			return;
		}

		video_preview_drag_offset_x = event.clientX - video_preview_drag_state.start_x;
		video_preview_drag_offset_y = event.clientY - video_preview_drag_state.start_y;

		if (
			Math.hypot(video_preview_drag_offset_x, video_preview_drag_offset_y) >
			video_preview_drag_click_suppression_distance
		) {
			video_preview_should_ignore_next_click = true;
		}
	}

	function end_video_preview_drag(event: PointerEvent) {
		if (
			video_preview_setting_drag_state &&
			video_preview_setting_drag_state.pointer_id === event.pointerId
		) {
			if (video_preview_setting_drag_state.has_moved) {
				event.preventDefault();
				event.stopPropagation();
				video_preview_should_ignore_next_click = true;
				release_video_preview_setting_drag_capture(event);
			}

			clear_video_preview_setting_drag();
		}

		if (
			video_preview_drag_pending_state &&
			video_preview_drag_pending_state.pointer_id === event.pointerId
		) {
			clear_video_preview_drag_hold();
			return;
		}

		if (!video_preview_drag_state || video_preview_drag_state.pointer_id !== event.pointerId) {
			return;
		}

		const distance = Math.hypot(video_preview_drag_offset_x, video_preview_drag_offset_y);
		video_preview_drag_state = undefined;
		(event.currentTarget as HTMLElement | null)?.releasePointerCapture(event.pointerId);

		if (distance > video_preview_drag_click_suppression_distance) {
			video_preview_should_ignore_next_click = true;
		}

		if (distance > video_preview_close_drag_distance) {
			close_video_preview();
			return;
		}

		video_preview_drag_offset_x = 0;
		video_preview_drag_offset_y = 0;
	}

	function cancel_video_preview_drag(event: PointerEvent) {
		if (
			video_preview_setting_drag_state &&
			video_preview_setting_drag_state.pointer_id === event.pointerId
		) {
			release_video_preview_setting_drag_capture(event);
			clear_video_preview_setting_drag();
		}

		if (
			video_preview_drag_pending_state &&
			video_preview_drag_pending_state.pointer_id === event.pointerId
		) {
			clear_video_preview_drag_hold();
			return;
		}

		if (!video_preview_drag_state || video_preview_drag_state.pointer_id !== event.pointerId) {
			return;
		}

		video_preview_drag_state = undefined;
		video_preview_drag_offset_x = 0;
		video_preview_drag_offset_y = 0;
		(event.currentTarget as HTMLElement | null)?.releasePointerCapture(event.pointerId);
	}

	function get_is_liked(post: PostFeedPost): boolean {
		const post_id = String(post.id);
		return liked_posts[post_id] ?? post.has_liked;
	}

	function get_confirmed_is_liked(post: PostFeedPost): boolean {
		const post_id = String(post.id);
		return confirmed_liked_posts[post_id] ?? post.has_liked;
	}

	function get_like_count(post: PostFeedPost): number {
		const post_id = String(post.id);
		return like_counts[post_id] ?? post.like_count;
	}

	function get_confirmed_like_count(post: PostFeedPost): number {
		const post_id = String(post.id);
		return confirmed_like_counts[post_id] ?? post.like_count;
	}

	function get_is_shared(post: PostFeedPost): boolean {
		const post_id = String(post.id);
		return shared_posts[post_id] ?? post.has_shared;
	}

	function get_confirmed_is_shared(post: PostFeedPost): boolean {
		const post_id = String(post.id);
		return confirmed_shared_posts[post_id] ?? post.has_shared;
	}

	function get_share_count(post: PostFeedPost): number {
		const post_id = String(post.id);
		return share_counts[post_id] ?? post.share_count;
	}

	function get_confirmed_share_count(post: PostFeedPost): number {
		const post_id = String(post.id);
		return confirmed_share_counts[post_id] ?? post.share_count;
	}

	function get_count_for_state(params: {
		confirmed_count: number;
		confirmed_state: boolean;
		desired_state: boolean;
	}) {
		if (params.confirmed_state === params.desired_state) {
			return params.confirmed_count;
		}

		return Math.max(0, params.confirmed_count + (params.desired_state ? 1 : -1));
	}

	function clear_post_action_timeout(
		timeouts: Map<string, ReturnType<typeof setTimeout>>,
		key: string
	) {
		const timeout = timeouts.get(key);

		if (!timeout) {
			return;
		}

		clearTimeout(timeout);
		timeouts.delete(key);
	}

	function clear_post_action_timeouts() {
		for (const timeout of like_sync_timeouts.values()) {
			clearTimeout(timeout);
		}

		for (const timeout of share_sync_timeouts.values()) {
			clearTimeout(timeout);
		}

		like_sync_timeouts.clear();
		share_sync_timeouts.clear();
	}

	function schedule_like_sync(key: string, delay_ms = post_action_sync_delay_ms) {
		clear_post_action_timeout(like_sync_timeouts, key);

		like_sync_timeouts.set(
			key,
			setTimeout(() => {
				like_sync_timeouts.delete(key);
				void sync_like_state(key);
			}, delay_ms)
		);
	}

	function schedule_share_sync(key: string, delay_ms = post_action_sync_delay_ms) {
		clear_post_action_timeout(share_sync_timeouts, key);

		share_sync_timeouts.set(
			key,
			setTimeout(() => {
				share_sync_timeouts.delete(key);
				void sync_share_state(key);
			}, delay_ms)
		);
	}

	async function sync_like_state(key: string) {
		if (like_requests_in_flight[key]) {
			schedule_like_sync(key);
			return;
		}

		const post = posts.find((candidate) => String(candidate.id) === key);
		if (!post) {
			return;
		}

		const requested_liked = get_is_liked(post);
		const confirmed_liked = get_confirmed_is_liked(post);
		const confirmed_count = get_confirmed_like_count(post);

		if (requested_liked === confirmed_liked) {
			like_counts = {
				...like_counts,
				[key]: confirmed_count
			};
			return;
		}

		like_requests_in_flight = {
			...like_requests_in_flight,
			[key]: true
		};

		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(key)}/like`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ liked: requested_liked })
			});

			if (!response.ok) {
				throw new Error('Failed to sync like');
			}

			const payload = (await response.json()) as { liked: boolean; like_count: number };
			confirmed_liked_posts = {
				...confirmed_liked_posts,
				[key]: payload.liked
			};
			confirmed_like_counts = {
				...confirmed_like_counts,
				[key]: payload.like_count
			};

			const current_desired_liked = get_is_liked(post);
			if (current_desired_liked === requested_liked) {
				liked_posts = {
					...liked_posts,
					[key]: payload.liked
				};
			}

			like_counts = {
				...like_counts,
				[key]: get_count_for_state({
					confirmed_count: payload.like_count,
					confirmed_state: payload.liked,
					desired_state: current_desired_liked
				})
			};

			if (current_desired_liked !== payload.liked) {
				schedule_like_sync(key, 0);
			}
		} catch {
			liked_posts = {
				...liked_posts,
				[key]: confirmed_liked
			};
			like_counts = {
				...like_counts,
				[key]: confirmed_count
			};
		} finally {
			like_requests_in_flight = {
				...like_requests_in_flight,
				[key]: false
			};
		}
	}

	async function sync_share_state(key: string) {
		if (share_requests_in_flight[key]) {
			schedule_share_sync(key);
			return;
		}

		const post = posts.find((candidate) => String(candidate.id) === key);
		if (!post) {
			return;
		}

		const requested_shared = get_is_shared(post);
		const confirmed_shared = get_confirmed_is_shared(post);
		const confirmed_count = get_confirmed_share_count(post);

		if (requested_shared === confirmed_shared) {
			share_counts = {
				...share_counts,
				[key]: confirmed_count
			};
			return;
		}

		share_requests_in_flight = {
			...share_requests_in_flight,
			[key]: true
		};

		try {
			const response = await fetch(`/api/posts/${encodeURIComponent(key)}/share`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ shared: requested_shared })
			});

			if (!response.ok) {
				throw new Error('Failed to sync share');
			}

			const payload = (await response.json()) as { shared: boolean; share_count: number };
			confirmed_shared_posts = {
				...confirmed_shared_posts,
				[key]: payload.shared
			};
			confirmed_share_counts = {
				...confirmed_share_counts,
				[key]: payload.share_count
			};

			const current_desired_shared = get_is_shared(post);
			if (current_desired_shared === requested_shared) {
				shared_posts = {
					...shared_posts,
					[key]: payload.shared
				};
			}

			share_counts = {
				...share_counts,
				[key]: get_count_for_state({
					confirmed_count: payload.share_count,
					confirmed_state: payload.shared,
					desired_state: current_desired_shared
				})
			};

			if (current_desired_shared !== payload.shared) {
				schedule_share_sync(key, 0);
			}
		} catch {
			shared_posts = {
				...shared_posts,
				[key]: confirmed_shared
			};
			share_counts = {
				...share_counts,
				[key]: confirmed_count
			};
		} finally {
			share_requests_in_flight = {
				...share_requests_in_flight,
				[key]: false
			};
		}
	}

	function toggle_like(post_id: string | number) {
		const key = String(post_id);
		const post = posts.find((candidate) => String(candidate.id) === key);
		if (!post) {
			return;
		}

		const next_is_liked = !get_is_liked(post);
		liked_posts = {
			...liked_posts,
			[key]: next_is_liked
		};
		like_counts = {
			...like_counts,
			[key]: get_count_for_state({
				confirmed_count: get_confirmed_like_count(post),
				confirmed_state: get_confirmed_is_liked(post),
				desired_state: next_is_liked
			})
		};
		schedule_like_sync(key);
	}

	function toggle_share(post_id: string | number) {
		const key = String(post_id);
		const post = posts.find((candidate) => String(candidate.id) === key);
		if (!post) {
			return;
		}

		const next_is_shared = !get_is_shared(post);
		shared_posts = {
			...shared_posts,
			[key]: next_is_shared
		};
		share_counts = {
			...share_counts,
			[key]: get_count_for_state({
				confirmed_count: get_confirmed_share_count(post),
				confirmed_state: get_confirmed_is_shared(post),
				desired_state: next_is_shared
			})
		};
		schedule_share_sync(key);
	}

	function mark_image_loaded(post_id: string | number) {
		const key = String(post_id);

		if (loaded_images[key]) {
			return;
		}

		loaded_images = {
			...loaded_images,
			[key]: true
		};
	}

	function mark_media_available(post_id: string | number) {
		const key = String(post_id);

		if (!unavailable_media[key]) {
			return;
		}

		unavailable_media = {
			...unavailable_media,
			[key]: false
		};
	}

	function mark_media_unavailable(post_id: string | number) {
		const key = String(post_id);

		mark_image_loaded(key);
		if (unavailable_media[key]) {
			return;
		}

		unavailable_media = {
			...unavailable_media,
			[key]: true
		};
	}

	function is_media_unavailable(post: PostFeedPost) {
		return Boolean(unavailable_media[String(post.id)]);
	}

	function is_post_media_pending(post: PostFeedPost) {
		return (
			post.media_type === 'image' &&
			Boolean(post.media_display_url ?? post.media_url) &&
			!is_media_unavailable(post) &&
			!loaded_images[String(post.id)]
		);
	}

	function get_post_video_src(post: PostFeedPost): string {
		return post.media_display_url ?? post.media_url ?? '';
	}

	function initialize_post_action_state(post: PostFeedPost) {
		const key = String(post.id);

		const initialize_boolean_state = (
			state: Record<string, boolean>,
			value: boolean
		): Record<string, boolean> => (state[key] === undefined ? { ...state, [key]: value } : state);

		const initialize_count_state = (
			state: Record<string, number>,
			value: number
		): Record<string, number> => (state[key] === undefined ? { ...state, [key]: value } : state);

		liked_posts = initialize_boolean_state(liked_posts, post.has_liked);
		confirmed_liked_posts = initialize_boolean_state(confirmed_liked_posts, post.has_liked);
		like_counts = initialize_count_state(like_counts, post.like_count);
		confirmed_like_counts = initialize_count_state(confirmed_like_counts, post.like_count);
		shared_posts = initialize_boolean_state(shared_posts, post.has_shared);
		confirmed_shared_posts = initialize_boolean_state(confirmed_shared_posts, post.has_shared);
		share_counts = initialize_count_state(share_counts, post.share_count);
		confirmed_share_counts = initialize_count_state(confirmed_share_counts, post.share_count);
	}

	function get_scroll_anchor_post_id(active_scroll_container: HTMLElement) {
		const container_top = active_scroll_container.getBoundingClientRect().top;
		let nearest_post_id = '';
		let nearest_distance = Number.POSITIVE_INFINITY;

		for (const [post_id, post_element] of post_elements) {
			const { top, bottom } = post_element.getBoundingClientRect();

			if (bottom <= container_top) {
				continue;
			}

			const distance = Math.abs(top - container_top);

			if (distance < nearest_distance) {
				nearest_distance = distance;
				nearest_post_id = post_id;
			}
		}

		return nearest_post_id;
	}

	async function update_view_query(next_view: 'grid' | 'feed') {
		const next_url = new URL(page.url);
		const active_scroll_container = get_active_scroll_container();
		const anchor_post_id = active_scroll_container
			? get_scroll_anchor_post_id(active_scroll_container)
			: '';

		if (next_view === 'grid') {
			next_url.searchParams.set('view', 'grid');
		} else {
			next_url.searchParams.delete('view');
		}

		if (anchor_post_id) {
			next_url.searchParams.set('focusPost', anchor_post_id);
			hasConsumedFocusPost = false;
		}

		const next_href = `${next_url.pathname}${next_url.search}${next_url.hash}`;

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(next_href, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function persist_scroll_position() {
		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container || !mounted_scroll_storage_key) {
			return;
		}

		try {
			const next_state: HomeFeedState = {
				return_href: `${page.url.pathname}${page.url.search}`,
				scroll_top: active_scroll_container.scrollTop,
				anchor_post_id: get_scroll_anchor_post_id(active_scroll_container)
			};
			const serialized_state = JSON.stringify(next_state);

			sessionStorage.setItem(mounted_scroll_storage_key, serialized_state);

			if (page.url.pathname === '/home') {
				set_last_home_feed_state(next_state);
				sessionStorage.setItem(last_home_state_storage_key, serialized_state);
			}
		} catch {
			// Ignore storage failures.
		}
	}

	function clear_scroll_persist_timeout() {
		if (!scroll_persist_timeout) {
			return;
		}

		clearTimeout(scroll_persist_timeout);
		scroll_persist_timeout = undefined;
	}

	function schedule_scroll_persist() {
		clear_scroll_persist_timeout();
		scroll_persist_timeout = setTimeout(() => {
			scroll_persist_timeout = undefined;
			persist_scroll_position();
		}, 160);
	}

	function schedule_load_more_check() {
		if (scroll_measure_frame) {
			return;
		}

		scroll_measure_frame = requestAnimationFrame(() => {
			scroll_measure_frame = undefined;
			maybe_load_more();
		});
	}

	function restore_scroll_position() {
		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container || !mounted_scroll_storage_key) {
			return;
		}

		try {
			const saved_state =
				(page.url.pathname === '/home' ? get_last_home_feed_state() : undefined) ??
				(sessionStorage.getItem(mounted_scroll_storage_key)
					? (JSON.parse(sessionStorage.getItem(mounted_scroll_storage_key)!) as HomeFeedState)
					: undefined) ??
				(sessionStorage.getItem(last_home_state_storage_key)
					? (JSON.parse(sessionStorage.getItem(last_home_state_storage_key)!) as HomeFeedState)
					: undefined);

			if (!saved_state) {
				return;
			}

			const next_scroll_top = Number(saved_state.scroll_top ?? 0);

			const apply_scroll_restore = () => {
				const anchor_post = saved_state.anchor_post_id
					? post_elements.get(saved_state.anchor_post_id)
					: undefined;

				if (anchor_post) {
					anchor_post.scrollIntoView({ block: 'start', behavior: 'auto' });
				}

				active_scroll_container.scrollTop = next_scroll_top;
			};

			apply_scroll_restore();
			requestAnimationFrame(apply_scroll_restore);
			setTimeout(apply_scroll_restore, 120);
			setTimeout(apply_scroll_restore, 320);
		} catch {
			// Ignore storage failures.
		}
	}

	function restore_focus_post() {
		if (!focus_post_id || hasConsumedFocusPost) {
			return false;
		}

		const target_post = post_elements.get(focus_post_id);

		if (!target_post) {
			return false;
		}

		hasConsumedFocusPost = true;
		target_post.scrollIntoView({ block: 'start', behavior: 'auto' });
		const cleaned_url = new URL(page.url);
		cleaned_url.searchParams.delete('focusPost');
		const cleaned_href = `${cleaned_url.pathname}${cleaned_url.search}${cleaned_url.hash}`;
		skip_next_scroll_restore = true;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(cleaned_href, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
		return true;
	}

	function request_more_posts() {
		if (!has_more || is_loading_more || !on_load_more) {
			return;
		}

		void on_load_more();
	}

	function get_load_more_threshold() {
		if (typeof window === 'undefined') {
			return 720;
		}

		const is_desktop = window.matchMedia('(min-width: 768px)').matches;
		const is_grid_view = page.url.searchParams.get('view') === 'grid';

		if (is_grid_view) {
			return is_desktop ? 2200 : 1600;
		}

		return is_desktop ? 900 : 700;
	}

	function prewarm_post_media(next_posts: PostFeedPost[]) {
		if (typeof window === 'undefined') {
			return;
		}

		const image_posts = next_posts.filter(
			(post) =>
				post.media_type === 'image' &&
				typeof (post.media_display_url ?? post.media_url) === 'string' &&
				(post.media_display_url ?? post.media_url)!.length > 0
		);

		for (const post of image_posts.slice(-8)) {
			const media_url = post.media_display_url ?? post.media_url!;

			if (prewarmed_media_urls.has(media_url)) {
				continue;
			}

			prewarmed_media_urls.add(media_url);
			const image = new Image();
			image.decoding = 'async';
			image.loading = 'eager';
			image.src = media_url;

			if ('decode' in image) {
				void image.decode().catch(() => {});
			}
		}
	}

	function refresh_load_more_observer() {
		load_more_observer?.disconnect();
		load_more_observer = undefined;

		if (
			typeof window === 'undefined' ||
			!has_infinite_feed ||
			!has_more ||
			!load_more_sentinel ||
			!on_load_more
		) {
			return;
		}

		const observer_options: IntersectionObserverInit = {
			rootMargin: `0px 0px ${get_load_more_threshold()}px 0px`,
			threshold: 0
		};
		const active_scroll_container = get_active_scroll_container();

		if (active_scroll_container) {
			observer_options.root = active_scroll_container;
		}

		load_more_observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					request_more_posts();
					break;
				}
			}
		}, observer_options);

		load_more_observer.observe(load_more_sentinel);
	}

	function maybe_load_more() {
		if (!has_infinite_feed || !has_more || is_loading_more || !on_load_more) {
			return;
		}

		const active_scroll_container = get_active_scroll_container();

		if (!active_scroll_container) {
			return;
		}

		const remaining_distance =
			active_scroll_container.scrollHeight -
			active_scroll_container.clientHeight -
			active_scroll_container.scrollTop;

		if (remaining_distance <= get_load_more_threshold()) {
			request_more_posts();
		}
	}

	function handle_feed_scroll() {
		schedule_load_more_check();
		schedule_scroll_persist();
	}

	onMount(() => {
		mounted_scroll_storage_key = `post-feed-scroll:${page.url.pathname}${page.url.search}`;
		sync_video_preview_viewport();

		void tick().then(() => {
			refresh_load_more_observer();
			const active_scroll_container = get_active_scroll_container();

			if (!active_scroll_container) {
				return;
			}

			if (restore_focus_post()) {
				return;
			}

			restore_scroll_position();
			maybe_load_more();
		});

		if (typeof window === 'undefined') {
			return;
		}

		window.addEventListener('resize', sync_video_preview_viewport);

		return () => {
			window.removeEventListener('resize', sync_video_preview_viewport);
		};
	});

	$effect(() => {
		if (!has_infinite_feed || is_loading_more) {
			return;
		}

		void tick().then(() => {
			refresh_load_more_observer();
			maybe_load_more();
		});
	});

	$effect(() => {
		const current_posts = posts;

		void tick().then(() => {
			prewarm_post_media(current_posts);
			refresh_load_more_observer();
		});
	});

	$effect(() => {
		for (const post of posts) {
			initialize_post_action_state(post);
		}
	});

	afterNavigate(() => {
		mounted_scroll_storage_key = `post-feed-scroll:${page.url.pathname}${page.url.search}`;
		void tick().then(() => {
			refresh_load_more_observer();
			if (restore_focus_post()) {
				return;
			}

			if (skip_next_scroll_restore) {
				skip_next_scroll_restore = false;
				maybe_load_more();
				return;
			}

			restore_scroll_position();
			maybe_load_more();
		});
	});

	beforeNavigate(() => {
		persist_scroll_position();
	});

	$effect(() => {
		if (!video_preview) {
			return;
		}

		void tick().then(() => {
			video_preview_backdrop?.focus();
			show_video_preview_controls();
		});
	});

	onDestroy(() => {
		load_more_observer?.disconnect();

		if (scroll_measure_frame) {
			cancelAnimationFrame(scroll_measure_frame);
		}

		clear_scroll_persist_timeout();

		clear_video_preview_controls_timeout();
		clear_video_preview_click_timeout();
		clear_video_preview_drag_hold();
		clear_post_action_timeouts();
		stop_video_preview_time_loop();
		video_preview_element?.pause();
		persist_scroll_position();
	});
</script>

<div
	bind:this={root_container}
	class="post-feed-page flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-[#09051c] text-white md:h-screen md:overflow-hidden"
	onscroll={handle_feed_scroll}
>
	<div
		class="z-10 flex items-center justify-between bg-[#09051c] p-4 md:sticky md:top-0 md:z-20 md:p-6 lg:p-8"
	>
		<div class="flex min-w-0 items-center gap-3 md:gap-4">
			{#if back_path}
				<a
					href={resolve(back_path)}
					class="group shrink-0 text-white/70 transition-colors duration-200 hover:text-white"
					aria-label="Go back"
				>
					<img
						src="/images/profile/go-back-icon.avif"
						alt=""
						class="h-8 w-8 transform object-contain transition-all duration-300 ease-out group-hover:scale-110 md:h-10 md:w-10"
					/>
				</a>
			{/if}

			<div class="min-w-0">
				{#if subtitle}
					<p class="truncate text-xs font-semibold tracking-[0.24em] text-sky-200/85 uppercase">
						{subtitle}
					</p>
				{/if}
				<h2 class="truncate text-2xl font-bold text-white md:text-4xl" data-nonselectable-ui="true">
					{title}
				</h2>
			</div>
		</div>

		<button
			class="group shrink-0 transition-colors duration-200 {isGridView
				? 'text-white'
				: 'text-white/70'} hover:text-white"
			onclick={() => {
				void update_view_query(isGridView ? 'feed' : 'grid');
			}}
			aria-label={isGridView ? 'Switch to feed view' : 'Switch to grid view'}
		>
			<img
				src="/images/home-screen/content-grid-view.avif"
				alt=""
				class="h-5 w-5 transform transition-all duration-300 ease-out group-hover:scale-110 {isGridView
					? 'opacity-100'
					: 'opacity-70'} md:h-7 md:w-7"
			/>
		</button>
	</div>
	{#if post_delete_error}
		<div
			class="mx-4 mb-3 rounded-2xl border border-rose-300/20 bg-rose-950/45 px-4 py-3 text-sm font-semibold text-rose-100 shadow-[0_14px_40px_rgba(0,0,0,0.18)] md:mx-8"
			aria-live="polite"
		>
			{post_delete_error}
		</div>
	{/if}

	<div
		bind:this={scroll_container}
		class="post-feed-scroll min-h-0 flex-1 overflow-visible px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:overflow-y-auto md:overscroll-y-none md:px-8 md:pb-8"
		onscroll={handle_feed_scroll}
	>
		{#if isGridView}
			<div
				class="post-feed-grid grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-2.5 lg:grid-cols-3 lg:gap-4 xl:gap-6 2xl:gap-8"
			>
				{#each visible_posts as post, index (post.id)}
					<div
						use:register_post_element={post.id}
						class="post-feed-card relative overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<div
							class={`transition-opacity duration-200 ${is_post_media_pending(post) ? 'opacity-0' : 'opacity-100'}`}
						>
							<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
								<a
									href={resolve(
										`/profile/${encodeURIComponent(post.author_username)}?returnTo=${encodeURIComponent(current_return_to)}&returnPostId=${encodeURIComponent(post.id)}`
									)}
									class="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-opacity outline-none hover:opacity-85"
									aria-label={`Open ${post.author_name}'s profile`}
								>
									{#if post.author_avatar}
										<ProgressiveImage
											src={post.author_avatar}
											alt={post.author_name}
											wrapper_class="h-10 w-10 rounded-full md:h-12 md:w-12"
											img_class="h-full w-full rounded-full object-cover"
											skeleton_class="rounded-full"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<div
											class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-12 md:w-12 md:text-sm"
										>
											{post.author_name?.[0]?.toUpperCase() ?? '?'}
										</div>
									{/if}
									<div class="min-w-0 overflow-hidden md:flex md:flex-col">
										<span class="block truncate text-base font-semibold text-white"
											>{post.author_name}</span
										>
										<span class="block truncate text-sm text-white/50 md:text-sm"
											>{time_ago(post.created_at)}</span
										>
									</div>
								</a>
								<div class="relative ml-auto shrink-0">
									<button
										type="button"
										class="shrink-0 rounded-full p-2 text-white/50 transition-colors hover:bg-white/8 hover:text-white"
										aria-haspopup="menu"
										aria-expanded={open_post_actions_menu_id === post.id}
										aria-label="Post options"
										onclick={() => toggle_post_actions_menu(post.id)}
									>
										<img
											src="/images/home-screen/three-dots-icon.avif"
											alt=""
											class="h-3 w-auto md:h-2 xl:h-3"
										/>
									</button>
									{#if open_post_actions_menu_id === post.id}
										<div
											class="absolute top-full right-0 z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#120b2b]/95 p-1.5 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md"
											role="menu"
										>
											{#if can_delete_post(post)}
												<button
													type="button"
													class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-100 disabled:cursor-wait disabled:opacity-60"
													role="menuitem"
													disabled={deleting_post_id === post.id}
													onclick={() => {
														void delete_post_from_feed(post);
													}}
												>
													<span>{deleting_post_id === post.id ? 'Deleting...' : 'Delete'}</span>
													<span aria-hidden="true">x</span>
												</button>
											{:else if can_hide_post(post)}
												<button
													type="button"
													class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-100 disabled:cursor-wait disabled:opacity-60"
													role="menuitem"
													disabled={hiding_post_id === post.id}
													onclick={() => {
														void hide_post_from_home_feed(post);
													}}
												>
													<span>{hiding_post_id === post.id ? 'Hiding...' : 'Hide from feed'}</span>
													<span aria-hidden="true">x</span>
												</button>
											{:else}
												<p class="px-3 py-2 text-xs font-medium text-white/50">
													No actions available
												</p>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<div class="relative mx-3 mt-3 aspect-4/5 w-auto overflow-hidden rounded-2xl md:mx-4">
								{#if get_post_path}
									<a
										href={resolve(get_post_path(post))}
										class="absolute inset-0 z-10"
										aria-label={`Open ${post.author_name}'s post`}
									></a>
								{/if}
								{#if post.media_url && is_media_unavailable(post)}
									<div
										class="absolute inset-0 z-15 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(125,212,255,0.18),transparent_35%),linear-gradient(145deg,rgba(17,13,38,0.96),rgba(7,7,20,0.98))] px-6 text-center text-white"
										role="status"
									>
										<p class="text-sm font-semibold">Media unavailable</p>
										<p class="mt-2 max-w-52 text-xs leading-5 text-white/62">
											This {post.media_type === 'video' ? 'video' : 'image'} no longer exists in storage.
										</p>
									</div>
								{:else if post.media_url && post.media_type === 'image'}
									<button
										type="button"
										class="absolute inset-0 z-15 block h-full w-full cursor-pointer overflow-hidden"
										onclick={() => open_post_detail(post)}
										aria-label={`View ${post.author_name}'s post`}
									>
										<ProgressiveImage
											src={post.media_display_url ?? post.media_url}
											srcset={post.media_display_srcset}
											sizes="(min-width: 1536px) 28vw, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
											alt="post"
											wrapper_class="h-full w-full"
											img_class="h-full w-full object-contain md:object-cover"
											skeleton_class="rounded-2xl"
											loading={index < 6 ? 'eager' : 'lazy'}
											decoding="async"
											fetchpriority={index < 6 ? 'high' : 'low'}
											on_load={() => {
												mark_image_loaded(post.id);
												mark_media_available(post.id);
											}}
											on_error={() => mark_media_unavailable(post.id)}
										/>
									</button>
								{:else if post.media_url && post.media_type === 'video'}
									<button
										type="button"
										class="absolute inset-0 z-15 block h-full w-full cursor-zoom-in overflow-hidden"
										onclick={() => {
											open_video_preview(
												get_post_video_src(post),
												`${post.author_name}'s post video`
											);
										}}
										aria-label={`Preview ${post.author_name}'s post video`}
									>
										<video
											src={get_post_video_src(post)}
											poster={post.media_poster_url}
											class="block h-full w-full object-contain md:object-cover"
											autoplay
											loop
											muted
											playsinline
											preload="metadata"
											onloadedmetadata={() => mark_media_available(post.id)}
											onerror={() => mark_media_unavailable(post.id)}
										></video>
									</button>
								{/if}
								{#if post.content}
									{#if expanded_captions[caption_key('grid', post.id)]}
										<button
											type="button"
											class="absolute inset-0 z-20 flex cursor-pointer items-end bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
											aria-label="Collapse caption"
											onclick={() => toggle_caption(caption_key('grid', post.id))}
										>
											<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
												<p
													class="user-content-text text-sm leading-6 whitespace-pre-line text-white"
												>
													{post.content}
												</p>
												{#if overflowing_captions[caption_key('grid', post.id)]}
													<span
														class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
														>See less</span
													>
												{/if}
											</div>
										</button>
									{:else}
										<div
											class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
										>
											<button
												type="button"
												class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('grid', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
												aria-label={overflowing_captions[caption_key('grid', post.id)]
													? 'Expand caption'
													: undefined}
												onclick={() => {
													if (overflowing_captions[caption_key('grid', post.id)])
														toggle_caption(caption_key('grid', post.id));
												}}
											>
												<p
													use:measure_caption={caption_key('grid', post.id)}
													class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
												>
													{post.content}
												</p>
											</button>
											{#if overflowing_captions[caption_key('grid', post.id)]}
												<button
													type="button"
													class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
													aria-label="Expand caption"
													onclick={() => toggle_caption(caption_key('grid', post.id))}
												>
													See more
												</button>
											{/if}
										</div>
									{/if}
								{/if}
							</div>

							<div
								class="2xl:pt:6 mx-6 flex items-center gap-6 pt-5 pb-5 md:gap-4 md:pt-4 md:pb-4 2xl:pb-6"
								data-nonselectable-ui="true"
							>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="group relative h-6 w-6 transition-opacity hover:opacity-70"
										onclick={() => {
											void toggle_like(post.id);
										}}
										aria-label={get_is_liked(post) ? 'Unlike post' : 'Like post'}
									>
										<img
											src="/images/home-screen/unliked-state.avif"
											alt=""
											class="absolute inset-0 h-6 w-auto origin-center cursor-pointer object-contain transition-all duration-250 ease-out {get_is_liked(
												post
											)
												? 'scale-75 opacity-0'
												: 'scale-100 opacity-100'}"
										/>
										<img
											src="/images/home-screen/liked-state.avif"
											alt="like"
											class="absolute inset-0 h-6 w-auto origin-center cursor-pointer object-contain transition-all duration-250 ease-out {get_is_liked(
												post
											)
												? 'scale-100 opacity-100'
												: 'scale-125 opacity-0'}"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_is_liked(post) ? 'text-rose-400' : 'text-white/70'}`}
										>{get_like_count(post)}</span
									>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="transition-opacity hover:opacity-70"
										onclick={() => open_post_detail(post)}
										aria-label="View comments"
									>
										<img
											src="/images/home-screen/comment-icon.avif"
											alt="comment"
											class="h-6 w-auto"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_post_comment_count(post) > 0 ? 'text-yellow-400' : 'text-white/70'}`}
										>{get_post_comment_count(post)}</span
									>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class={`cursor-pointer transition-opacity hover:opacity-70 ${get_is_shared(post) ? 'opacity-100' : 'opacity-80'}`}
										onclick={() => {
											void toggle_share(post.id);
										}}
										aria-label={get_is_shared(post) ? 'Unshare post' : 'Share post'}
									>
										<img
											src="/images/home-screen/share-post-icon.avif"
											alt="share"
											class="h-6 w-auto"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_is_shared(post) ? 'text-green-400' : 'text-white/70'}`}
										>{get_share_count(post)}</span
									>
								</div>
							</div>
						</div>

						{#if is_post_media_pending(post)}
							<div
								class="post-feed-card-skeleton absolute inset-0 z-30 px-5 pt-5 pb-5 md:px-5 md:pt-5 md:pb-4"
							>
								<div class="flex items-center gap-3">
									<div
										class="post-feed-skeleton-shimmer h-10 w-10 rounded-full md:h-12 md:w-12"
									></div>
									<div class="min-w-0 flex-1 space-y-2">
										<div class="post-feed-skeleton-shimmer h-4 w-28 rounded-full"></div>
										<div class="post-feed-skeleton-shimmer h-3 w-20 rounded-full"></div>
									</div>
									<div class="post-feed-skeleton-shimmer h-3 w-5 rounded-sm"></div>
								</div>
								<div class="mt-3 overflow-hidden rounded-2xl">
									<div class="post-feed-image-placeholder aspect-4/5 w-full"></div>
								</div>
								<div class="mx-1 flex items-center gap-6 pt-5 md:gap-4 md:pt-4">
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-5 md:gap-8">
				{#each visible_posts as post, index (post.id)}
					<div
						use:register_post_element={post.id}
						class="post-feed-card relative w-full max-w-xl overflow-hidden rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
					>
						<div
							class={`flex flex-col justify-center transition-opacity duration-200 ${is_post_media_pending(post) ? 'opacity-0' : 'opacity-100'}`}
						>
							<div class="flex items-center gap-3 px-5 pt-5 md:gap-3">
								<a
									href={resolve(
										`/profile/${encodeURIComponent(post.author_username)}?returnTo=${encodeURIComponent(current_return_to)}&returnPostId=${encodeURIComponent(post.id)}`
									)}
									class="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-opacity outline-none hover:opacity-85"
									aria-label={`Open ${post.author_name}'s profile`}
								>
									{#if post.author_avatar}
										<ProgressiveImage
											src={post.author_avatar}
											alt={post.author_name}
											wrapper_class="h-10 w-10 rounded-full md:h-11 md:w-11"
											img_class="h-full w-full rounded-full object-cover"
											skeleton_class="rounded-full"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<div
											class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white md:h-11 md:w-11 md:text-sm"
										>
											{post.author_name?.[0]?.toUpperCase() ?? '?'}
										</div>
									{/if}
									<div class="min-w-0 overflow-hidden md:flex md:flex-col">
										<span class="block truncate text-base font-semibold text-white md:text-xl"
											>{post.author_name}</span
										>
										<span class="block truncate text-sm text-white/50 md:text-sm"
											>{time_ago(post.created_at)}</span
										>
									</div>
								</a>
								<div class="relative ml-auto shrink-0">
									<button
										type="button"
										class="shrink-0 rounded-full p-2 text-white/50 transition-colors hover:bg-white/8 hover:text-white"
										aria-haspopup="menu"
										aria-expanded={open_post_actions_menu_id === post.id}
										aria-label="Post options"
										onclick={() => toggle_post_actions_menu(post.id)}
									>
										<img src="/images/home-screen/three-dots-icon.avif" alt="" class="h-3 w-auto" />
									</button>
									{#if open_post_actions_menu_id === post.id}
										<div
											class="absolute top-full right-0 z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#120b2b]/95 p-1.5 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md"
											role="menu"
										>
											{#if can_delete_post(post)}
												<button
													type="button"
													class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-100 disabled:cursor-wait disabled:opacity-60"
													role="menuitem"
													disabled={deleting_post_id === post.id}
													onclick={() => {
														void delete_post_from_feed(post);
													}}
												>
													<span>{deleting_post_id === post.id ? 'Deleting...' : 'Delete'}</span>
													<span aria-hidden="true">x</span>
												</button>
											{:else if can_hide_post(post)}
												<button
													type="button"
													class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-100 disabled:cursor-wait disabled:opacity-60"
													role="menuitem"
													disabled={hiding_post_id === post.id}
													onclick={() => {
														void hide_post_from_home_feed(post);
													}}
												>
													<span>{hiding_post_id === post.id ? 'Hiding...' : 'Hide from feed'}</span>
													<span aria-hidden="true">x</span>
												</button>
											{:else}
												<p class="px-3 py-2 text-xs font-medium text-white/50">
													No actions available
												</p>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<div
								class="relative mx-3 mt-3 aspect-4/5 w-auto overflow-hidden rounded-2xl bg-black/20 md:mx-4"
							>
								{#if post.media_url && is_media_unavailable(post)}
									<div
										class="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(125,212,255,0.18),transparent_35%),linear-gradient(145deg,rgba(17,13,38,0.96),rgba(7,7,20,0.98))] px-6 text-center text-white"
										role="status"
									>
										<p class="text-sm font-semibold">Media unavailable</p>
										<p class="mt-2 max-w-52 text-xs leading-5 text-white/62">
											This {post.media_type === 'video' ? 'video' : 'image'} no longer exists in storage.
										</p>
									</div>
								{:else if post.media_url && post.media_type === 'image'}
									<button
										type="button"
										class="block h-full w-full cursor-pointer overflow-hidden"
										onclick={() => open_post_detail(post)}
										aria-label={`View ${post.author_name}'s post`}
									>
										<ProgressiveImage
											src={post.media_display_url ?? post.media_url}
											srcset={post.media_display_srcset}
											sizes="(min-width: 1024px) 42rem, (min-width: 768px) calc(100vw - 12rem), calc(100vw - 2rem)"
											alt="post"
											wrapper_class="h-full w-full"
											img_class="h-full w-full object-cover"
											skeleton_class="rounded-2xl"
											loading={index < 4 ? 'eager' : 'lazy'}
											decoding="async"
											fetchpriority={index < 4 ? 'high' : 'low'}
											on_load={() => {
												mark_image_loaded(post.id);
												mark_media_available(post.id);
											}}
											on_error={() => mark_media_unavailable(post.id)}
										/>
									</button>
								{:else if post.media_url && post.media_type === 'video'}
									<button
										type="button"
										class="block h-full w-full cursor-zoom-in overflow-hidden"
										onclick={() => {
											open_video_preview(
												get_post_video_src(post),
												`${post.author_name}'s post video`
											);
										}}
										aria-label={`Preview ${post.author_name}'s post video`}
									>
										<video
											src={get_post_video_src(post)}
											poster={post.media_poster_url}
											class="block h-full w-full object-cover"
											autoplay
											loop
											muted
											playsinline
											preload="metadata"
											onloadedmetadata={() => mark_media_available(post.id)}
											onerror={() => mark_media_unavailable(post.id)}
										></video>
									</button>
								{/if}
								{#if post.content}
									{#if expanded_captions[caption_key('feed', post.id)]}
										<button
											type="button"
											class="absolute inset-0 z-20 flex cursor-pointer items-end rounded-2xl bg-black/55 px-4 py-4 text-left backdrop-blur-[1px]"
											aria-label="Collapse caption"
											onclick={() => toggle_caption(caption_key('feed', post.id))}
										>
											<div class="caption-overlay-scroll max-h-full w-full overflow-y-auto pr-1">
												<p
													class="user-content-text text-sm leading-6 whitespace-pre-line text-white"
												>
													{post.content}
												</p>
												{#if overflowing_captions[caption_key('feed', post.id)]}
													<span
														class="mt-3 inline-block text-xs font-semibold tracking-wide text-sky-300"
														>See less</span
													>
												{/if}
											</div>
										</button>
									{:else}
										<div
											class="absolute right-0 bottom-0 left-0 z-20 bg-linear-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-left"
										>
											<button
												type="button"
												class={`block w-full pr-28 text-left ${overflowing_captions[caption_key('feed', post.id)] ? 'cursor-pointer' : 'cursor-default'}`}
												aria-label={overflowing_captions[caption_key('feed', post.id)]
													? 'Expand caption'
													: undefined}
												onclick={() => {
													if (overflowing_captions[caption_key('feed', post.id)])
														toggle_caption(caption_key('feed', post.id));
												}}
											>
												<p
													use:measure_caption={caption_key('feed', post.id)}
													class="user-content-text caption-preview text-sm leading-5 whitespace-pre-line text-white"
												>
													{post.content}
												</p>
											</button>
											{#if overflowing_captions[caption_key('feed', post.id)]}
												<button
													type="button"
													class="absolute right-3 bottom-2.5 z-10 rounded-full bg-[#7DD4FF] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-sky-200/25 hover:text-white"
													aria-label="Expand caption"
													onclick={() => toggle_caption(caption_key('feed', post.id))}
												>
													See more
												</button>
											{/if}
										</div>
									{/if}
								{/if}
							</div>

							<div
								class="mx-2 flex items-center gap-5 px-4 py-5 md:gap-6 md:px-5 2xl:pt-6 2xl:pb-6"
								data-nonselectable-ui="true"
							>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="group relative h-6 w-6 transition-opacity hover:opacity-70"
										onclick={() => {
											void toggle_like(post.id);
										}}
										aria-label={get_is_liked(post) ? 'Unlike post' : 'Like post'}
									>
										<img
											src="/images/home-screen/unliked-state.avif"
											alt=""
											class="absolute inset-0 h-6 w-auto origin-center cursor-pointer object-contain transition-all duration-250 ease-out {get_is_liked(
												post
											)
												? 'scale-75 opacity-0'
												: 'scale-100 opacity-100'}"
										/>
										<img
											src="/images/home-screen/liked-state.avif"
											alt="like"
											class="absolute inset-0 h-6 w-auto origin-center cursor-pointer object-contain transition-all duration-250 ease-out {get_is_liked(
												post
											)
												? 'scale-100 opacity-100'
												: 'scale-125 opacity-0'}"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_is_liked(post) ? 'text-rose-400' : 'text-white/70'}`}
										>{get_like_count(post)}</span
									>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="transition-opacity hover:opacity-70"
										onclick={() => open_post_detail(post)}
										aria-label="View comments"
									>
										<img
											src="/images/home-screen/comment-icon.avif"
											alt="comment"
											class="h-6 w-auto"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_post_comment_count(post) > 0 ? 'text-yellow-400' : 'text-white/70'}`}
										>{get_post_comment_count(post)}</span
									>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class={`cursor-pointer transition-opacity hover:opacity-70 ${get_is_shared(post) ? 'opacity-100' : 'opacity-80'}`}
										onclick={() => {
											void toggle_share(post.id);
										}}
										aria-label={get_is_shared(post) ? 'Unshare post' : 'Share post'}
									>
										<img
											src="/images/home-screen/share-post-icon.avif"
											alt="share"
											class="h-6 w-auto"
										/>
									</button>
									<span
										class={`min-w-5 text-xs ${get_is_shared(post) ? 'text-green-400' : 'text-white/70'}`}
										>{get_share_count(post)}</span
									>
								</div>
							</div>
						</div>

						{#if is_post_media_pending(post)}
							<div
								class="post-feed-card-skeleton absolute inset-0 z-30 px-5 pt-5 pb-5 md:px-5 md:pt-5 md:pb-5"
							>
								<div class="flex items-center gap-3">
									<div
										class="post-feed-skeleton-shimmer h-10 w-10 rounded-full md:h-11 md:w-11"
									></div>
									<div class="min-w-0 flex-1 space-y-2">
										<div class="post-feed-skeleton-shimmer h-4 w-28 rounded-full"></div>
										<div class="post-feed-skeleton-shimmer h-3 w-20 rounded-full"></div>
									</div>
									<div class="post-feed-skeleton-shimmer h-3 w-5 rounded-sm"></div>
								</div>
								<div class="mt-3 overflow-hidden rounded-2xl">
									<div class="post-feed-image-placeholder aspect-4/5 w-full"></div>
								</div>
								<div class="mx-1 flex items-center gap-5 pt-5 md:gap-6">
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
									<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if isGridView && has_infinite_feed && is_loading_more}
			<div
				class="post-feed-loading-grid mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-2.5 lg:grid-cols-3 lg:gap-4 xl:gap-6 2xl:gap-8"
				aria-hidden="true"
			>
				{#each grid_loading_placeholders as placeholder (placeholder)}
					<div class="post-feed-skeleton-card overflow-hidden rounded-4xl">
						<div class="flex items-center gap-3 px-5 pt-5">
							<div class="post-feed-skeleton-shimmer h-10 w-10 rounded-full md:h-12 md:w-12"></div>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="post-feed-skeleton-shimmer h-4 w-28 rounded-full"></div>
								<div class="post-feed-skeleton-shimmer h-3 w-20 rounded-full"></div>
							</div>
						</div>
						<div class="mx-3 mt-3 aspect-4/5 overflow-hidden rounded-2xl md:mx-4">
							<div class="post-feed-image-placeholder h-full w-full"></div>
						</div>
						<div class="mx-6 flex items-center gap-6 pt-5 pb-5 md:gap-4 md:pt-4 md:pb-4 2xl:pb-6">
							<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
							<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
							<div class="post-feed-skeleton-shimmer h-6 w-6 rounded-full"></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if has_infinite_feed && has_more}
			<div bind:this={load_more_sentinel} class="h-px w-full"></div>
		{/if}

		{#if has_infinite_feed && is_loading_more}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="feed-load-more-card flex items-center justify-center gap-3 rounded-[1.75rem] px-4 py-3 text-sm text-white/85 backdrop-blur-md"
				>
					<span class="feed-load-more-pulse h-2.5 w-2.5 rounded-full bg-sky-300"></span>
					<span class="font-medium">Loading more posts</span>
					<span class="feed-load-more-pulse h-2.5 w-2.5 rounded-full bg-fuchsia-300"></span>
				</div>
			</div>
		{:else if has_infinite_feed && load_more_error}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="flex items-center justify-between gap-3 rounded-[1.75rem] border border-rose-300/20 bg-[linear-gradient(135deg,rgba(120,15,35,0.35),rgba(255,255,255,0.06))] px-4 py-3 text-sm text-rose-100 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-md"
				>
					<span>{load_more_error}</span>
					<button
						type="button"
						class="rounded-full border border-white/12 bg-white/10 px-3 py-1 font-medium text-white transition-all duration-200 hover:bg-white/16"
						onclick={request_more_posts}
					>
						Retry
					</button>
				</div>
			</div>
		{:else if has_infinite_feed && !has_more && visible_posts.length > 0}
			<div class="mx-auto w-full max-w-xl px-1 pt-2 pb-1">
				<div
					class="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-4 py-3 text-center text-xs tracking-[0.22em] text-white/55 uppercase backdrop-blur-md"
				>
					You&apos;re all caught up
				</div>
			</div>
		{/if}

		<div class="h-36 shrink-0 md:hidden" aria-hidden="true"></div>
	</div>
</div>

{#if detail_post}
	<PostDetailModal
		post={detail_post}
		liked={get_is_liked(detail_post)}
		like_count={get_like_count(detail_post)}
		shared={get_is_shared(detail_post)}
		share_count={get_share_count(detail_post)}
		on_close={close_post_detail}
		on_comment_count_change={(next_count) =>
			handle_post_comment_count_change(detail_post!.id, next_count)}
		on_like={() => toggle_like(detail_post!.id)}
		on_share={() => toggle_share(detail_post!.id)}
		on_video_preview={(src, alt) => open_video_preview(src, alt)}
	/>
{/if}

{#if video_preview}
	<div
		class="video-preview-overlay fixed inset-0 z-160 overflow-hidden bg-black"
		role="dialog"
		aria-modal="true"
		aria-label="Video preview"
		tabindex="0"
		bind:this={video_preview_backdrop}
		transition:fade={{ duration: 180 }}
		onkeydown={handle_video_preview_keydown}
		onpointerdown={begin_video_preview_drag}
		onpointermove={handle_video_preview_pointer_move}
		onpointerup={end_video_preview_drag}
		onpointercancel={cancel_video_preview_drag}
	>
		<div
			class="video-preview-stage relative flex h-full w-full items-center justify-center"
			role="button"
			tabindex="0"
			onclick={handle_video_preview_stage_click}
			ondblclick={handle_video_preview_stage_double_click}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					event.stopPropagation();
					handle_video_preview_stage_click(event);
				}
			}}
			style={`transform: translate3d(${video_preview_drag_offset_x}px, ${video_preview_drag_offset_y}px, 0) scale(${video_preview_drag_state ? 0.96 : 1}); opacity: ${video_preview_drag_state ? 0.88 : 1};`}
			transition:scale={{ duration: 220, start: 0.94, opacity: 0.55 }}
		>
			<div class="video-preview-backdrop-glow" aria-hidden="true"></div>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video_preview_element}
				src={video_preview.src}
				class="video-preview-media max-h-full max-w-full bg-black object-contain"
				style={`filter:brightness(${video_preview_brightness}%);`}
				autoplay
				playsinline
				preload="metadata"
				onloadstart={show_video_preview_buffering}
				onloadedmetadata={sync_video_preview_time}
				onloadeddata={hide_video_preview_buffering}
				oncanplay={hide_video_preview_buffering}
				oncanplaythrough={hide_video_preview_buffering}
				ontimeupdate={sync_video_preview_time}
				onplay={sync_video_preview_time}
				onplaying={hide_video_preview_buffering}
				onpause={sync_video_preview_time}
				onwaiting={show_video_preview_buffering}
				onstalled={show_video_preview_buffering}
				onsuspend={hide_video_preview_buffering}
				onended={handle_video_preview_ended}
			></video>

			{#if video_preview_is_buffering}
				<div
					class="video-preview-loading pointer-events-none absolute inset-0 z-10 grid place-items-center"
				>
					<div class="video-preview-loading-pill" role="status" aria-live="polite">
						<span class="video-preview-loading-spinner" aria-hidden="true"></span>
						<span>Loading</span>
					</div>
				</div>
			{/if}

			{#if video_preview_touch_setting_panel}
				<div
					class="video-preview-gesture-setting-panel pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 {video_preview_touch_setting_panel ===
					'brightness'
						? 'left-[max(1rem,env(safe-area-inset-left))] md:left-8'
						: 'right-[max(1rem,env(safe-area-inset-right))] md:right-8'}"
					aria-hidden="true"
				>
					<div class="video-preview-setting-track">
						<div
							class="video-preview-setting-fill"
							style={`height:${get_video_preview_setting_fill_percent(video_preview_touch_setting_panel)}%;`}
						></div>
						<span class="video-preview-setting-value">
							{video_preview_touch_setting_panel === 'brightness'
								? video_preview_brightness
								: video_preview_volume}%
						</span>
						<span class="video-preview-gesture-setting-icon">
							{#if video_preview_touch_setting_panel === 'brightness'}
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
							{:else}
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
							{/if}
						</span>
					</div>
				</div>
			{/if}

			<div
				class="video-preview-close-hover-zone absolute top-0 left-0 z-19"
				aria-hidden="true"
				onpointerenter={() => set_video_preview_controls_region_active(true)}
				onpointermove={() => set_video_preview_controls_region_active(true)}
				onpointerleave={() => set_video_preview_controls_region_active(false)}
				onpointerdown={() => {
					set_video_preview_controls_region_active(true);
				}}
				onpointerup={release_video_preview_controls_region_for_touch}
				onpointercancel={release_video_preview_controls_region_for_touch}
			></div>

			<div
				class="video-preview-bottom-hover-zone absolute inset-x-0 bottom-0 z-19"
				aria-hidden="true"
				onpointerenter={() => set_video_preview_controls_region_active(true)}
				onpointermove={() => set_video_preview_controls_region_active(true)}
				onpointerleave={() => set_video_preview_controls_region_active(false)}
				onpointerdown={() => {
					set_video_preview_controls_region_active(true);
				}}
				onpointerup={release_video_preview_controls_region_for_touch}
				onpointercancel={release_video_preview_controls_region_for_touch}
			></div>

			<div
				class={`video-preview-chrome pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 transition-all duration-220 md:p-6 ${video_preview_controls_visible ? 'translate-y-0 opacity-100' : '-translate-y-2.5 opacity-0'}`}
			>
				<button
					type="button"
					class="video-preview-close pointer-events-auto"
					data-video-preview-control="true"
					onclick={close_video_preview}
					onpointerenter={() => set_video_preview_controls_region_active(true)}
					onpointermove={() => set_video_preview_controls_region_active(true)}
					onpointerleave={() => set_video_preview_controls_region_active(false)}
					onpointerup={release_video_preview_controls_region_for_touch}
					onpointercancel={release_video_preview_controls_region_for_touch}
					aria-label="Close video preview"
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>

			<div
				class={`video-preview-chrome video-preview-bottom-gradient pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 transition-all duration-220 md:p-6 ${video_preview_controls_visible ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0'}`}
			>
				<div
					class="video-preview-bottom-shell pointer-events-auto"
					role="presentation"
					data-video-preview-control="true"
					onpointerenter={() => set_video_preview_controls_region_active(true)}
					onpointermove={() => set_video_preview_controls_region_active(true)}
					onpointerleave={() => set_video_preview_controls_region_active(false)}
					onpointerup={release_video_preview_controls_region_for_touch}
					onpointercancel={release_video_preview_controls_region_for_touch}
				>
					<div class="video-preview-control-icons">
						<div class="video-preview-icon-stack">
							{#if active_video_preview_panel === 'brightness'}
								<div class="video-preview-setting-panel">
									<div class="video-preview-setting-track">
										<div
											class="video-preview-setting-fill"
											style={`height:${get_video_preview_setting_fill_percent('brightness')}%;`}
										></div>
										<span class="video-preview-setting-value">{video_preview_brightness}%</span>
									</div>
									<input
										type="range"
										min="40"
										max="160"
										step="1"
										value={video_preview_brightness}
										oninput={handle_video_preview_brightness_input}
										class="video-preview-setting-slider"
										aria-label="Adjust brightness"
									/>
								</div>
							{/if}
							<button
								type="button"
								class="video-preview-icon-button"
								data-video-preview-control="true"
								onclick={() => toggle_video_preview_panel('brightness')}
								aria-label="Adjust brightness"
								aria-pressed={active_video_preview_panel === 'brightness'}
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
							class="video-preview-icon-button"
							data-video-preview-control="true"
							onclick={() => seek_video_preview(-5)}
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
							class="video-preview-icon-button video-preview-icon-button-play"
							data-video-preview-control="true"
							onclick={() => toggle_video_preview_playback()}
							aria-label={video_preview_is_playing ? 'Pause video' : 'Play video'}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="video-preview-svg">
								{#if video_preview_is_playing}
									<path d="M8.5 6.5h2.8v11H8.5zm4.2 0h2.8v11h-2.8z" fill="currentColor" />
								{:else}
									<path
										d="M8 6.2 17.5 12 8 17.8V6.2Z"
										fill="none"
										stroke="currentColor"
										stroke-linejoin="round"
										stroke-width="1.8"
									/>
								{/if}
							</svg>
						</button>
						<button
							type="button"
							class="video-preview-icon-button"
							data-video-preview-control="true"
							onclick={() => seek_video_preview(5)}
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
							{#if active_video_preview_panel === 'volume'}
								<div class="video-preview-setting-panel">
									<div class="video-preview-setting-track">
										<div
											class="video-preview-setting-fill"
											style={`height:${get_video_preview_setting_fill_percent('volume')}%;`}
										></div>
										<span class="video-preview-setting-value">{video_preview_volume}%</span>
									</div>
									<input
										type="range"
										min="0"
										max="100"
										step="1"
										value={video_preview_volume}
										oninput={handle_video_preview_volume_input}
										class="video-preview-setting-slider"
										aria-label="Adjust volume"
									/>
								</div>
							{/if}
							<button
								type="button"
								class="video-preview-icon-button"
								data-video-preview-control="true"
								onclick={() => toggle_video_preview_panel('volume')}
								aria-label="Adjust volume"
								aria-pressed={active_video_preview_panel === 'volume'}
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
					<div class="video-preview-track-column mt-4">
						<div class="video-preview-time-row">
							<span class="video-preview-time">{format_media_time(video_preview_current_time)}</span
							>
							<span class="video-preview-time">{format_media_time(video_preview_duration)}</span>
						</div>
						<div
							class="video-preview-slider-shell"
							role="presentation"
							data-video-preview-control="true"
							style={`--video-preview-progress-ratio:${get_video_preview_seek_ratio()};`}
							onpointerdown={begin_video_preview_seek_drag}
							onpointermove={move_video_preview_seek_drag}
							onpointerup={end_video_preview_seek_drag}
							onpointercancel={end_video_preview_seek_drag}
						>
							<div class="video-preview-slider-track" aria-hidden="true"></div>
							<div class="video-preview-slider-progress" aria-hidden="true"></div>
							<div class="video-preview-slider-thumb" aria-hidden="true"></div>
							<input
								type="range"
								min="0"
								max={Math.max(video_preview_duration, 0.1)}
								step="any"
								value={get_video_preview_seek_value()}
								oninput={handle_video_preview_seek}
								class="video-preview-slider w-full"
								aria-label="Seek video"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
