<script lang="ts">
	import './profile.css';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { PageProps } from './$types';
	import LanguageDropdown from '$lib/components/LanguageDropdown.svelte';
	import { build_responsive_image_source } from '$lib/utilities/responsive-image';
	import ProgressiveImage from '$lib/components/ProgressiveImage.svelte';
	import { background_video_post as background_video_post_store } from '$lib/state/background-video-post';
	import { is_reserved_profile_username, slugify_username } from '$lib/utilities/profile';
	import {
		format_profile_phone,
		get_profile_phone_country,
		localize_profile_validation_message,
		name_validator,
		PROFILE_PHONE_COUNTRIES,
		profile_bio_validator,
		profile_location_validator,
		profile_phone_validator,
		type ProfilePhoneCountry
	} from '$lib/utilities/validator';

	const { data, form }: PageProps = $props();

	const cover_image =
		'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=75';
	const about_icons = {
		location: '/images/profile/Address.avif',
		email: '/images/profile/Gmail.avif',
		phone: '/images/profile/Phone.avif',
		add: '/images/profile/Add.avif'
	};

	const profile_icons = {
		share: '/images/profile/share-account.avif',
		edit: '/images/profile/edit-profile.avif',
		settings: '/images/profile/setting.avif',
		relationship: '/images/profile/add-friend.avif',
		relationship_followed: '/images/profile/followed-icon.avif',
		message: '/images/profile/send-message-icon.avif'
	};

	const profile_about = $derived(
		data['profile'] as (typeof data)['profile'] & {
			location?: string | null;
			phone?: string | null;
		}
	);
	const return_to = $derived.by(() => {
		const raw_value = page.url.searchParams.get('returnTo')?.trim();

		if (!raw_value || !raw_value.startsWith('/')) {
			return;
		}

		return raw_value;
	});
	const return_post_id = $derived(page.url.searchParams.get('returnPostId')?.trim() ?? '');

	let active_tab = $state<'posts' | 'videos' | 'shared'>('posts');
	let upload_modal_open = $state(false);
	let upload_media_type = $state<'image' | 'video'>('image');
	let is_phone_country_dropdown_open = $state(false);
	let upload_modal_backdrop = $state<HTMLDivElement | undefined>();
	let image_preview_backdrop = $state<HTMLDivElement | undefined>();
	let image_editor_backdrop = $state<HTMLDivElement | undefined>();
	let image_actions_backdrop = $state<HTMLDivElement | undefined>();
	let post_image_input = $state<HTMLInputElement | undefined>();
	let post_video_input = $state<HTMLInputElement | undefined>();
	let video_editor_preview_element = $state<HTMLVideoElement | undefined>();
	let profile_image_input = $state<HTMLInputElement | undefined>();
	let cover_image_input = $state<HTMLInputElement | undefined>();
	let profile_image_form = $state<HTMLFormElement | undefined>();
	let cover_image_form = $state<HTMLFormElement | undefined>();
	let image_editor_stage = $state<HTMLDivElement | undefined>();
	let image_preview = $state<
		| {
				src: string;
				alt: string;
				is_avatar: boolean;
		  }
		| undefined
	>();
	let image_actions = $state<
		| {
				mode: 'avatar' | 'cover';
				preview_src?: string;
				preview_alt: string;
				is_avatar: boolean;
		  }
		| undefined
	>();
	let image_editor = $state<
		| {
				mode: 'avatar' | 'cover' | 'post' | 'video-post';
				src: string;
				file_name: string;
				mime_type: string;
				natural_width: number;
				natural_height: number;
				duration_seconds?: number;
		  }
		| undefined
	>();
	let image_editor_zoom = $state(1);
	let image_editor_offset_x = $state(0);
	let image_editor_offset_y = $state(0);
	let image_editor_drag_hint_visible = $state(false);
	let image_editor_drag_hint_timeout: ReturnType<typeof setTimeout> | undefined;
	let image_editor_zoom_step_timeout: ReturnType<typeof setTimeout> | undefined;
	let image_editor_zoom_step_interval: ReturnType<typeof setInterval> | undefined;
	let image_editor_drag_state = $state<
		| {
				pointer_id: number;
				start_x: number;
				start_y: number;
				origin_offset_x: number;
				origin_offset_y: number;
		  }
		| undefined
	>();
	let image_editor_error = $state('');
	let is_applying_image_editor = $state(false);
	let is_saving_profile_media = $state(false);
	let profile_media_error = $state('');
	let image_editor_object_url = $state('');
	let post_editor_source_file = $state<File | undefined>();
	let upload_media_error = $state('');
	let direct_video_public_id = $state('');
	let direct_video_secure_url = $state('');
	let active_video_upload_xhr: XMLHttpRequest | undefined;
	let active_video_post_abort_controller: AbortController | undefined;
	let is_background_video_cancel_confirming = $state(false);
	let background_video_post = $state<
		| {
				error_message?: string;
				file_name: string;
				progress_percent: number;
				status: 'uploading' | 'saving' | 'complete' | 'error';
		  }
		| undefined
	>();

	function sync_background_video_post_store() {
		if (!background_video_post) {
			background_video_post_store.set(undefined);
			return;
		}

		background_video_post_store.set({
			...background_video_post,
			cancel: cancel_background_video_post,
			confirm_cancel: confirm_cancel_background_video_post,
			dismiss: dismiss_background_video_post,
			keep_uploading: keep_background_video_post_uploading,
			is_cancel_confirming: is_background_video_cancel_confirming
		});
	}
	let selected_image = $state<File>();
	let selected_video = $state<File>();
	let image_src = $state('');
	let video_src = $state('');
	let post_video_duration_seconds = $state(0);
	let post_video_trim_start_seconds = $state(0);
	let post_video_trim_end_seconds = $state(0);
	let video_trim_preview_focus = $state<'start' | 'end'>('start');
	let is_editing_profile = $state(false);
	let edit_profile_name = $state('');
	let edit_profile_username = $state('');
	let edit_profile_bio = $state('');
	let edit_profile_location = $state('');
	let edit_profile_phone = $state('');
	let edit_profile_phone_country = $state<ProfilePhoneCountry>('US');
	let edit_profile_email = $state('');
	let edit_profile_email_visible = $state(false);

	const SERVER_FUNCTION_UPLOAD_SAFE_BYTES = 4 * 1024 * 1024;
	const MAX_SELECTED_IMAGE_BYTES = 10 * 1024 * 1024;
	const MAX_POST_IMAGE_BYTES = MAX_SELECTED_IMAGE_BYTES;
	const MAX_POST_VIDEO_OUTPUT_BYTES = 80 * 1024 * 1024;
	const MAX_POST_VIDEO_SOURCE_BYTES = 99 * 1024 * 1024;
	const CLOUDINARY_CHUNKED_VIDEO_THRESHOLD_BYTES = 60 * 1024 * 1024;
	const CLOUDINARY_VIDEO_CHUNK_BYTES = 20 * 1024 * 1024;
	const safe_upload_size_label = '4MB';
	const video_upload_size_label = '80MB';
	const selected_image_size_label = '10MB';

	const current_video_source_bytes = $derived.by(() => {
		const video_source_file =
			image_editor?.mode === 'video-post' ? post_editor_source_file : selected_video;

		return video_source_file?.size ?? 0;
	});

	const estimated_trimmed_video_bytes = $derived.by(() => {
		const video_source_file =
			image_editor?.mode === 'video-post' ? post_editor_source_file : selected_video;

		if (!video_source_file || post_video_duration_seconds <= 0) {
			return 0;
		}

		const trimmed_duration_seconds = Math.max(
			0,
			post_video_trim_end_seconds - post_video_trim_start_seconds
		);

		return Math.round(
			(video_source_file.size * trimmed_duration_seconds) / post_video_duration_seconds
		);
	});
	const is_estimated_trimmed_video_too_large = $derived(
		estimated_trimmed_video_bytes > MAX_POST_VIDEO_OUTPUT_BYTES
	);
	const estimated_trimmed_video_size_label = $derived(
		estimated_trimmed_video_bytes <= 0 ? '0 MB' : format_file_size(estimated_trimmed_video_bytes)
	);

	const post_tiles = $derived.by(() =>
		data['photo_posts'].map((post) => ({
			id: post.id,
			image: build_responsive_image_source(post.image_url, {
				widths: [360, 540, 720, 960, 1200],
				height: 'match-width',
				fit: 'lfill',
				quality: 100
			})
		}))
	);
	const video_tiles = $derived(
		data['video_posts'] as Array<{ id: string; poster_url?: string; video_url: string }>
	);
	const shared_post_tiles = $derived.by(() =>
		data['shared_posts'].map((post) => ({
			id: post.id,
			media_type: post.media_type,
			media_poster_url: post.media_poster_url,
			media_url: post.media_display_url ?? post.media_url,
			image:
				post.media_type === 'image' && (post.media_display_url ?? post.media_url)
					? build_responsive_image_source(post.media_display_url ?? post.media_url ?? '', {
							widths: [360, 540, 720, 960, 1200],
							height: 'match-width',
							fit: 'lfill',
							quality: 100
						})
					: undefined
		}))
	);

	const success_message = $derived(
		(form as { success?: boolean } | null | undefined)?.success === true
	);
	const form_message = $derived((form as { message?: string } | null | undefined)?.message ?? '');
	const profile_display_name = $derived(data['profile'].name ?? data['profile'].username);
	const profile_avatar = $derived(data['profile'].image);
	const profile_cover = $derived(data['profile'].cover_image ?? cover_image);
	const profile_cover_source = $derived(
		build_responsive_image_source(profile_cover, {
			widths: [960, 1280, 1600, 1920, 2560],
			fit: 'lfill',
			quality: 100
		})
	);
	const profile_avatar_source = $derived(
		profile_avatar
			? build_responsive_image_source(profile_avatar, {
					widths: [128, 192, 256, 384, 512, 640],
					height: 'match-width',
					fit: 'lfill',
					quality: 100
				})
			: undefined
	);
	const account_email = $derived(data['profile'].account_email ?? data['profile'].email ?? '');
	const image_editor_frame_ratio = $derived.by(() => {
		if (image_editor?.mode === 'cover') {
			return 16 / 6;
		}

		if (image_editor?.mode === 'post' || image_editor?.mode === 'video-post') {
			return image_editor.natural_width / image_editor.natural_height;
		}

		return 1;
	});
	let isrelationship_following = $state(false);
	let profile_followers_count = $state(0);
	let relationship_profile_sync_key = $state('');
	let relationship_sync_queue = Promise.resolve();
	const relationship_icon_source = $derived(
		isrelationship_following ? profile_icons.relationship_followed : profile_icons.relationship
	);
	const relationship_background_style = $derived(
		isrelationship_following
			? 'linear-gradient(90deg, #AAAAAA30 0%, #77777730 50%, #7AA5BB30 75%, #7DD4FF30 100%)'
			: '#3F2C56'
	);
	const relationship_shadow_style = $derived(
		isrelationship_following
			? '0 4px 12px rgba(125, 212, 255, 0.55), inset 1px -1px 30px 0px #CD82FF, inset 0.5px -0.5px 10px 0px #CD82FF'
			: ''
	);
	const relationship_followed_effect_style = $derived(
		isrelationship_following
			? `box-shadow:${relationship_shadow_style};backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);`
			: ''
	);

	$effect(() => {
		if (is_editing_profile) {
			return;
		}

		edit_profile_name = data['profile'].name ?? data['profile'].username;
		edit_profile_username = data['profile'].username;
		edit_profile_bio = data['profile'].bio ?? '';
		edit_profile_location = profile_about.location ?? '';
		edit_profile_phone = profile_about.phone ?? '';
		edit_profile_phone_country = get_profile_phone_country(profile_about.phone ?? '');
		edit_profile_email = account_email;
		edit_profile_email_visible = data['profile'].email_visible ?? false;
	});

	$effect(() => {
		if (edit_profile_email.trim()) {
			return;
		}

		edit_profile_email_visible = false;
	});

	async function start_profile_editing() {
		const scroll_container = document.querySelector('.profile-scroll');
		const current_scroll = scroll_container?.scrollTop ?? 0;

		is_editing_profile = true;

		await tick();

		if (scroll_container) {
			scroll_container.scrollTop = current_scroll;
		}
	}

	async function set_active_profile_tab(next_tab: 'posts' | 'videos' | 'shared') {
		if (active_tab === next_tab) {
			return;
		}

		const scroll_container = document.querySelector('.profile-scroll');
		const current_scroll = scroll_container?.scrollTop ?? 0;

		active_tab = next_tab;
		await tick();

		requestAnimationFrame(() => {
			if (scroll_container) {
				scroll_container.scrollTop = current_scroll;
			}
		});
	}

	function cancel_profile_editing() {
		is_editing_profile = false;
		reset_profile_edit_fields();
	}

	function reset_profile_edit_fields() {
		edit_profile_name = data['profile'].name ?? data['profile'].username;
		edit_profile_username = data['profile'].username;
		edit_profile_bio = data['profile'].bio ?? '';
		edit_profile_location = profile_about.location ?? '';
		edit_profile_phone = profile_about.phone ?? '';
		edit_profile_phone_country = get_profile_phone_country(profile_about.phone ?? '');
		edit_profile_email = account_email;
		edit_profile_email_visible = data['profile'].email_visible ?? false;
	}

	function reset_profile_about_field(
		field: 'bio' | 'location' | 'email' | 'phone' | 'email_visible'
	) {
		if (field === 'bio') {
			edit_profile_bio = data['profile'].bio ?? '';
			return;
		}

		if (field === 'location') {
			edit_profile_location = profile_about.location ?? '';
			return;
		}

		if (field === 'email') {
			edit_profile_email = account_email;
			edit_profile_email_visible = data['profile'].email_visible ?? false;
			return;
		}

		if (field === 'phone') {
			edit_profile_phone = profile_about.phone ?? '';
			edit_profile_phone_country = get_profile_phone_country(profile_about.phone ?? '');
			return;
		}

		edit_profile_email_visible = data['profile'].email_visible ?? false;
	}

	function get_profile_name_validation_message(value: string, label: 'Nickname' | 'Username') {
		if (!value.trim()) {
			return get_localized_profile_validation_message(`${label} is required`);
		}

		const result = name_validator(value);
		if (!result.is_Valid) {
			return get_localized_profile_validation_message(
				(result.message ?? `Invalid ${label}`).replace('Name', label)
			);
		}

		if (label === 'Username' && is_reserved_profile_username(slugify_username(value))) {
			return get_localized_profile_validation_message('Please choose a different @username.');
		}

		return '';
	}

	function get_profile_validation_locale() {
		if (typeof navigator === 'undefined') {
			return '';
		}

		return navigator.languages.find((locale) => locale.toLowerCase().startsWith('ja')) ?? '';
	}

	function get_localized_profile_validation_message(message: string) {
		return localize_profile_validation_message(message, get_profile_validation_locale());
	}

	function apply_profile_name_validation(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_profile_name_validation_message(input.value, 'Nickname'));
	}

	function apply_profile_username_validation(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_profile_name_validation_message(input.value, 'Username'));
	}

	function apply_profile_location_validation(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const result = profile_location_validator(input.value);
		input.setCustomValidity(
			result.is_Valid
				? ''
				: get_localized_profile_validation_message(
						result.message ?? 'Please enter a valid address.'
					)
		);
	}

	function apply_profile_phone_validation(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const result = profile_phone_validator(input.value);
		input.setCustomValidity(
			result.is_Valid
				? ''
				: get_localized_profile_validation_message(
						result.message ?? 'Please enter a valid phone number.'
					)
		);
	}

	function apply_profile_bio_validation(event: Event) {
		const textarea = event.currentTarget as HTMLTextAreaElement;
		const result = profile_bio_validator(textarea.value);
		textarea.setCustomValidity(
			result.is_Valid
				? ''
				: get_localized_profile_validation_message(
						result.message ?? 'Bio must be 200 characters or less.'
					)
		);
	}

	function handle_profile_phone_input(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const formatted_phone = format_profile_phone(input.value, edit_profile_phone_country);
		edit_profile_phone = formatted_phone;
		input.value = formatted_phone;
		apply_profile_phone_validation(event);
	}

	function handle_profile_phone_country_change(country: string) {
		edit_profile_phone_country = country as ProfilePhoneCountry;
		edit_profile_phone = format_profile_phone(edit_profile_phone, edit_profile_phone_country);
	}

	function handle_phone_country_dropdown_open_change(open: boolean) {
		is_phone_country_dropdown_open = open;
	}

	function format_file_size(bytes: number) {
		return `${Math.max(0.1, Math.round((bytes / (1024 * 1024)) * 10) / 10)}MB`;
	}

	function get_selected_image_size_error(file: File, label: string) {
		if (file.size <= MAX_SELECTED_IMAGE_BYTES) {
			return '';
		}

		return `${label} is ${format_file_size(file.size)}. Please choose an image ${selected_image_size_label} or smaller before editing.`;
	}

	function get_server_upload_size_error(file: File, label: string) {
		if (file.size <= SERVER_FUNCTION_UPLOAD_SAFE_BYTES) {
			return '';
		}

		return `${label} is ${format_file_size(file.size)} after editing. Please adjust it until the edited file is ${safe_upload_size_label} or smaller so Vercel can accept the upload.`;
	}

	function open_upload_modal(media_type: 'image' | 'video' = 'image') {
		clear_post_preview();
		caption = '';
		upload_media_error = '';
		upload_media_type = media_type;
		submitting_post = false;
		upload_modal_open = true;
	}

	function close_upload_modal() {
		if (submitting_post) {
			return;
		}

		submitting_post = false;
		caption = '';
		upload_media_error = '';
		clear_post_preview();
		upload_modal_open = false;
	}

	function open_image_preview(src: string, alt: string, is_avatar: boolean) {
		image_preview = {
			src,
			alt,
			is_avatar
		};
	}

	function close_image_preview() {
		image_preview = undefined;
	}

	function open_cover_image_picker() {
		cover_image_input?.click();
	}

	function open_profile_image_picker() {
		profile_image_input?.click();
	}

	function open_image_actions_menu(
		mode: 'avatar' | 'cover',
		preview_src: string | undefined,
		preview_alt: string,
		is_avatar: boolean
	) {
		image_actions = {
			mode,
			preview_alt,
			is_avatar,
			...(preview_src ? { preview_src } : {})
		};
	}

	function close_image_actions_menu() {
		image_actions = undefined;
	}

	function preview_from_image_actions() {
		if (!image_actions) {
			return;
		}

		if (!image_actions.preview_src) {
			return;
		}

		open_image_preview(
			image_actions.preview_src,
			image_actions.preview_alt,
			image_actions.is_avatar
		);
		close_image_actions_menu();
	}

	function change_from_image_actions() {
		if (!image_actions) {
			return;
		}

		const next_mode = image_actions.mode;
		close_image_actions_menu();

		if (next_mode === 'cover') {
			open_cover_image_picker();
			return;
		}

		open_profile_image_picker();
	}

	function format_media_time(seconds: number) {
		const normalized = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(normalized / 60);
		const remaining_seconds = normalized % 60;

		return `${minutes}:${String(remaining_seconds).padStart(2, '0')}`;
	}

	let caption = $state('');
	let share_feedback = $state('');
	let submitting_post = $state(false);
	const has_selected_post_media = $derived(
		upload_media_type === 'video'
			? Boolean(selected_video || direct_video_public_id)
			: Boolean(selected_image)
	);
	const post_validation_message = $derived.by(() => {
		if (caption.trim().length === 0 || has_selected_post_media) {
			return '';
		}

		return upload_media_type === 'video'
			? 'Add a video before posting. Captions need a video.'
			: 'Add a photo before posting. Captions need an image.';
	});

	$effect(() => {
		sync_background_video_post_store();
	});

	$effect(() => {
		const next_sync_key = data['profile'].user_id;

		if (relationship_profile_sync_key === next_sync_key) {
			return;
		}

		relationship_profile_sync_key = next_sync_key;
		isrelationship_following =
			!data['relationship'].is_own_profile && data['relationship'].is_following;
		profile_followers_count = data['stats'].followers_count;
	});

	$effect(() => {
		if (!upload_modal_open) {
			return;
		}

		void tick().then(() => {
			upload_modal_backdrop?.focus();
		});
	});

	$effect(() => {
		if (!image_preview) {
			return;
		}

		void tick().then(() => {
			image_preview_backdrop?.focus();
		});
	});

	$effect(() => {
		if (!image_actions) {
			return;
		}

		void tick().then(() => {
			image_actions_backdrop?.focus();
		});
	});

	$effect(() => {
		if (!image_editor) {
			return;
		}

		void tick().then(() => {
			image_editor_backdrop?.focus();
		});
	});

	function clear_post_preview() {
		if (image_src) {
			URL.revokeObjectURL(image_src);
		}

		if (video_src) {
			URL.revokeObjectURL(video_src);
		}

		if (post_image_input) {
			post_image_input.value = '';
		}

		if (post_video_input) {
			post_video_input.value = '';
		}

		selected_image = undefined;
		selected_video = undefined;
		direct_video_public_id = '';
		direct_video_secure_url = '';
		image_src = '';
		video_src = '';
		post_video_duration_seconds = 0;
		post_video_trim_start_seconds = 0;
		post_video_trim_end_seconds = 0;
		post_editor_source_file = undefined;
	}

	async function handle_image_file_change(event: Event) {
		if (submitting_post) {
			return;
		}

		const target = event.currentTarget as HTMLInputElement | null;
		const file = target?.files?.[0];

		if (!file) {
			return;
		}

		upload_media_error = '';
		if (file.size > MAX_POST_IMAGE_BYTES) {
			upload_media_error = get_selected_image_size_error(file, 'Photo');
			target.value = '';
			return;
		}

		post_editor_source_file = file;
		await open_image_editor(file, 'post');
	}

	async function handle_video_file_change(event: Event) {
		if (submitting_post) {
			return;
		}

		const target = event.currentTarget as HTMLInputElement | null;
		const file = target?.files?.[0];

		if (!file) {
			return;
		}

		upload_media_error = '';
		if (file.size > MAX_POST_VIDEO_SOURCE_BYTES) {
			upload_media_error =
				'Video source must be 100MB or smaller. Trim or compress the video before uploading.';
			target.value = '';
			return;
		}

		post_editor_source_file = file;
		direct_video_public_id = '';
		direct_video_secure_url = '';
		await open_image_editor(file, 'video-post');
	}

	function remove_image() {
		if (submitting_post) {
			return;
		}

		clear_post_preview();
	}

	function reopen_post_image_editor() {
		if (submitting_post) {
			return;
		}

		if (!post_editor_source_file) {
			return;
		}

		void open_image_editor(
			post_editor_source_file,
			upload_media_type === 'video' ? 'video-post' : 'post'
		);
	}

	async function handle_post_submit(event: SubmitEvent) {
		if (submitting_post) {
			event.preventDefault();
			return;
		}

		if (!has_selected_post_media) {
			event.preventDefault();
			submitting_post = false;
			return;
		}

		if (upload_media_type === 'image' && selected_image) {
			const upload_size_error = get_server_upload_size_error(selected_image, 'Photo');
			if (upload_size_error) {
				event.preventDefault();
				upload_media_error = upload_size_error;
				submitting_post = false;
				return;
			}
		}

		if (
			upload_media_type === 'video' &&
			!direct_video_public_id &&
			estimated_trimmed_video_bytes > MAX_POST_VIDEO_OUTPUT_BYTES
		) {
			event.preventDefault();
			submitting_post = false;
			return;
		}

		if (upload_media_type === 'video' && !direct_video_public_id) {
			event.preventDefault();

			const video_file = selected_video ?? post_editor_source_file;
			if (!video_file) {
				upload_media_error = 'Please choose the video again.';
				submitting_post = false;
				return;
			}

			void start_background_video_post({
				caption: caption.trim(),
				file: video_file,
				trim_end_seconds: post_video_trim_end_seconds,
				trim_start_seconds: post_video_trim_start_seconds,
				video_duration_seconds: post_video_duration_seconds
			});
			return;
		}

		submitting_post = true;
	}

	function reset_image_editor_view() {
		image_editor_zoom = 1;
		image_editor_offset_x = 0;
		image_editor_offset_y = 0;
		image_editor_error = '';
		image_editor_drag_state = undefined;
		clear_image_editor_drag_hint_timeout();
		image_editor_drag_hint_visible = is_image_editor_draggable();
	}

	function clear_profile_cover_inputs() {
		image_editor = undefined;

		if (profile_image_input) {
			profile_image_input.value = '';
		}

		if (cover_image_input) {
			cover_image_input.value = '';
		}

		if (image_editor_object_url) {
			URL.revokeObjectURL(image_editor_object_url);
			image_editor_object_url = '';
		}
	}

	function revoke_image_editor_object_url() {
		if (!image_editor_object_url) {
			return;
		}

		URL.revokeObjectURL(image_editor_object_url);
		image_editor_object_url = '';
	}

	function reset_post_editor_input(active_mode: NonNullable<typeof image_editor>['mode']) {
		if (active_mode === 'post' && !selected_image && !image_src && post_image_input) {
			post_image_input.value = '';
			post_editor_source_file = undefined;
			return;
		}

		if (active_mode !== 'video-post' || selected_video || video_src || !post_video_input) {
			return;
		}

		post_video_input.value = '';
		post_editor_source_file = undefined;
		post_video_duration_seconds = 0;
		post_video_trim_start_seconds = 0;
		post_video_trim_end_seconds = 0;
	}

	function close_post_image_editor(
		active_mode: NonNullable<typeof image_editor>['mode'],
		options?: { reset_inputs?: boolean }
	) {
		if (options?.reset_inputs !== false) {
			reset_post_editor_input(active_mode);
		}

		revoke_image_editor_object_url();
	}

	function close_image_editor(options?: { reset_inputs?: boolean }) {
		const active_mode = image_editor?.mode;
		image_editor = undefined;
		video_editor_preview_element = undefined;
		is_applying_image_editor = false;
		reset_image_editor_view();

		if (active_mode === 'post' || active_mode === 'video-post') {
			close_post_image_editor(active_mode, options);
			return;
		}

		if (options?.reset_inputs !== false) {
			clear_profile_cover_inputs();
			return;
		}

		revoke_image_editor_object_url();
	}

	function get_image_editor_frame_size() {
		if (!image_editor_stage || !image_editor) {
			return;
		}

		const frame_width = image_editor_stage.clientWidth;
		const frame_height = frame_width / image_editor_frame_ratio;

		if (frame_width === 0 || frame_height === 0) {
			return;
		}

		return { frame_width, frame_height };
	}

	function get_image_editor_scale() {
		if (!image_editor) {
			return;
		}

		const frame = get_image_editor_frame_size();

		if (!frame) {
			return;
		}

		const cover_scale = Math.max(
			frame.frame_width / image_editor.natural_width,
			frame.frame_height / image_editor.natural_height
		);

		return cover_scale * image_editor_zoom;
	}

	function is_image_editor_draggable() {
		if (!image_editor || image_editor.mode === 'video-post') {
			return false;
		}

		const frame = get_image_editor_frame_size();
		const scale = get_image_editor_scale();

		if (!frame || !scale) {
			const image_ratio = image_editor.natural_width / image_editor.natural_height;

			return image_editor_zoom > 1.01 || Math.abs(image_ratio - image_editor_frame_ratio) > 0.01;
		}

		const rendered_width = image_editor.natural_width * scale;
		const rendered_height = image_editor.natural_height * scale;

		return rendered_width > frame.frame_width + 1 || rendered_height > frame.frame_height + 1;
	}

	function clamp_image_editor_offsets(next_x: number, next_y: number) {
		if (!image_editor) {
			return { x: 0, y: 0 };
		}

		const frame = get_image_editor_frame_size();
		const scale = get_image_editor_scale();

		if (!frame || !scale) {
			return { x: next_x, y: next_y };
		}

		const rendered_width = image_editor.natural_width * scale;
		const rendered_height = image_editor.natural_height * scale;
		const max_x = Math.max(0, (rendered_width - frame.frame_width) / 2);
		const max_y = Math.max(0, (rendered_height - frame.frame_height) / 2);

		return {
			x: Math.min(max_x, Math.max(-max_x, next_x)),
			y: Math.min(max_y, Math.max(-max_y, next_y))
		};
	}

	function sync_image_editor_offsets() {
		const next_offsets = clamp_image_editor_offsets(image_editor_offset_x, image_editor_offset_y);
		image_editor_offset_x = next_offsets.x;
		image_editor_offset_y = next_offsets.y;
	}

	function update_image_editor_zoom(next_zoom: number) {
		if (is_applying_image_editor) {
			return;
		}

		image_editor_zoom = Math.min(3, Math.max(1, next_zoom));
		sync_image_editor_offsets();
		show_image_editor_drag_hint();
	}

	function step_image_editor_zoom(direction: -1 | 1) {
		update_image_editor_zoom(image_editor_zoom + direction * 0.05);
	}

	function stop_image_editor_zoom_step() {
		if (image_editor_zoom_step_timeout) {
			clearTimeout(image_editor_zoom_step_timeout);
			image_editor_zoom_step_timeout = undefined;
		}

		if (image_editor_zoom_step_interval) {
			clearInterval(image_editor_zoom_step_interval);
			image_editor_zoom_step_interval = undefined;
		}
	}

	function start_image_editor_zoom_step(direction: -1 | 1) {
		if (is_applying_image_editor) {
			return;
		}

		stop_image_editor_zoom_step();
		step_image_editor_zoom(direction);

		image_editor_zoom_step_timeout = setTimeout(() => {
			image_editor_zoom_step_interval = setInterval(() => {
				step_image_editor_zoom(direction);
			}, 55);
			image_editor_zoom_step_timeout = undefined;
		}, 260);
	}

	function clear_image_editor_drag_hint_timeout() {
		if (!image_editor_drag_hint_timeout) {
			return;
		}

		clearTimeout(image_editor_drag_hint_timeout);
		image_editor_drag_hint_timeout = undefined;
	}

	function show_image_editor_drag_hint() {
		clear_image_editor_drag_hint_timeout();
		image_editor_drag_hint_visible = is_image_editor_draggable();
	}

	function schedule_image_editor_drag_hint() {
		clear_image_editor_drag_hint_timeout();

		if (!is_image_editor_draggable()) {
			image_editor_drag_hint_visible = false;
			return;
		}

		image_editor_drag_hint_timeout = setTimeout(() => {
			image_editor_drag_hint_visible = true;
			image_editor_drag_hint_timeout = undefined;
		}, 900);
	}

	async function open_image_editor(file: File, mode: 'avatar' | 'cover' | 'post' | 'video-post') {
		reset_image_editor_view();

		if (image_editor_object_url) {
			URL.revokeObjectURL(image_editor_object_url);
		}

		const next_src = URL.createObjectURL(file);
		image_editor_object_url = next_src;

		if (mode === 'video-post') {
			const video_metadata = await new Promise<{
				duration_seconds: number;
				height: number;
				width: number;
			}>((resolve, reject) => {
				const probe = document.createElement('video');
				probe.preload = 'metadata';
				probe.onloadedmetadata = () => {
					resolve({
						duration_seconds: probe.duration,
						height: probe.videoHeight,
						width: probe.videoWidth
					});
				};
				probe.onerror = () => {
					reject(new Error('Video failed to load.'));
				};
				probe.src = next_src;
			});

			image_editor = {
				mode,
				src: next_src,
				file_name: file.name,
				mime_type: file.type || 'video/mp4',
				natural_width: video_metadata.width,
				natural_height: video_metadata.height,
				duration_seconds: video_metadata.duration_seconds
			};

			post_video_duration_seconds = video_metadata.duration_seconds;
			post_video_trim_start_seconds = 0;
			post_video_trim_end_seconds = video_metadata.duration_seconds;
			video_trim_preview_focus = 'start';
		} else {
			const image_metadata = await new Promise<{ height: number; width: number }>(
				(resolve, reject) => {
					const probe = new Image();
					probe.onload = () => {
						resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
					};
					probe.onerror = () => {
						reject(new Error('Image failed to load.'));
					};
					probe.src = next_src;
				}
			);

			image_editor = {
				mode,
				src: next_src,
				file_name: file.name,
				mime_type: file.type || 'image/jpeg',
				natural_width: image_metadata.width,
				natural_height: image_metadata.height
			};
		}

		await tick();
		if (mode === 'video-post') {
			image_editor_drag_hint_visible = false;
			return;
		}

		show_image_editor_drag_hint();
	}

	async function handle_selected_profile_or_cover_image(event: Event, mode: 'avatar' | 'cover') {
		const target = event.currentTarget as HTMLInputElement | null;
		const file = target?.files?.[0];

		if (!file) {
			return;
		}

		profile_media_error = '';
		const size_error = get_selected_image_size_error(
			file,
			mode === 'avatar' ? 'Profile photo' : 'Cover photo'
		);
		if (size_error) {
			profile_media_error = size_error;
			target.value = '';
			return;
		}

		await open_image_editor(file, mode);
	}

	function handle_profile_media_submit(event: SubmitEvent, label: string) {
		const form = event.currentTarget as HTMLFormElement;
		const file = Array.from(form.elements).find(
			(element): element is HTMLInputElement =>
				element instanceof HTMLInputElement && element.type === 'file'
		)?.files?.[0];

		if (!file) {
			return;
		}

		const size_error = get_server_upload_size_error(file, label);
		if (size_error) {
			event.preventDefault();
			is_saving_profile_media = false;
			profile_media_error = size_error;
		}
	}

	function handle_profile_image_change(event: Event) {
		void handle_selected_profile_or_cover_image(event, 'avatar');
	}

	function handle_cover_image_change(event: Event) {
		void handle_selected_profile_or_cover_image(event, 'cover');
	}

	function begin_image_editor_drag(event: PointerEvent) {
		if (!image_editor || is_applying_image_editor) {
			return;
		}

		event.preventDefault();
		clear_image_editor_drag_hint_timeout();
		image_editor_drag_hint_visible = false;
		image_editor_drag_state = {
			pointer_id: event.pointerId,
			start_x: event.clientX,
			start_y: event.clientY,
			origin_offset_x: image_editor_offset_x,
			origin_offset_y: image_editor_offset_y
		};

		(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
	}

	function move_image_editor_drag(event: PointerEvent) {
		if (!image_editor_drag_state || image_editor_drag_state.pointer_id !== event.pointerId) {
			return;
		}

		const delta_x = event.clientX - image_editor_drag_state.start_x;
		const delta_y = event.clientY - image_editor_drag_state.start_y;
		const next_offsets = clamp_image_editor_offsets(
			image_editor_drag_state.origin_offset_x + delta_x,
			image_editor_drag_state.origin_offset_y + delta_y
		);
		image_editor_offset_x = next_offsets.x;
		image_editor_offset_y = next_offsets.y;
	}

	function end_image_editor_drag(event: PointerEvent) {
		if (!image_editor_drag_state || image_editor_drag_state.pointer_id !== event.pointerId) {
			return;
		}

		image_editor_drag_state = undefined;
		(event.currentTarget as HTMLElement | null)?.releasePointerCapture(event.pointerId);
		schedule_image_editor_drag_hint();
	}

	async function load_image_for_editor(src: string) {
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const next_image = new Image();
			next_image.onload = () => resolve(next_image);
			next_image.onerror = () => reject(new Error('Preview image could not be loaded.'));
			next_image.src = src;
		});
	}

	async function create_editor_blob(
		editor: NonNullable<typeof image_editor>,
		frame: NonNullable<ReturnType<typeof get_image_editor_frame_size>>,
		scale: number
	) {
		const output_width =
			editor.mode === 'cover' ? 1600 : editor.mode === 'post' ? editor.natural_width : 900;
		const output_height =
			editor.mode === 'cover' ? 600 : editor.mode === 'post' ? editor.natural_height : 900;
		const canvas = document.createElement('canvas');
		canvas.width = output_width;
		canvas.height = output_height;
		const context = canvas.getContext('2d');

		if (!context) {
			throw new Error('Canvas not available.');
		}

		const source_image = await load_image_for_editor(editor.src);
		const crop_width_in_source = frame.frame_width / scale;
		const crop_height_in_source = frame.frame_height / scale;
		const source_center_x = editor.natural_width / 2 - image_editor_offset_x / scale;
		const source_center_y = editor.natural_height / 2 - image_editor_offset_y / scale;
		const source_x = Math.max(
			0,
			Math.min(
				editor.natural_width - crop_width_in_source,
				source_center_x - crop_width_in_source / 2
			)
		);
		const source_y = Math.max(
			0,
			Math.min(
				editor.natural_height - crop_height_in_source,
				source_center_y - crop_height_in_source / 2
			)
		);

		context.drawImage(
			source_image,
			source_x,
			source_y,
			crop_width_in_source,
			crop_height_in_source,
			0,
			0,
			output_width,
			output_height
		);

		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) => {
					if (result) {
						resolve(result);
						return;
					}

					reject(new Error('Could not create cropped image.'));
				},
				editor.mime_type || 'image/jpeg',
				0.95
			);
		});
	}

	function submit_cropped_editor_file(editor: NonNullable<typeof image_editor>, blob: Blob) {
		const cropped_file = new File([blob], editor.file_name, {
			type: blob.type || editor.mime_type || 'image/jpeg'
		});
		const upload_size_error = get_server_upload_size_error(
			cropped_file,
			editor.mode === 'avatar' ? 'Profile photo' : editor.mode === 'cover' ? 'Cover photo' : 'Photo'
		);
		if (upload_size_error) {
			throw new Error(upload_size_error);
		}

		const transfer = new DataTransfer();
		transfer.items.add(cropped_file);

		if (editor.mode === 'post' && post_image_input) {
			if (image_src) {
				URL.revokeObjectURL(image_src);
			}

			post_image_input.files = transfer.files;
			post_editor_source_file = cropped_file;
			selected_image = cropped_file;
			image_src = URL.createObjectURL(cropped_file);
			close_image_editor({ reset_inputs: false });
			return;
		}

		if (editor.mode === 'avatar' && profile_image_input && profile_image_form) {
			profile_image_input.files = transfer.files;
			profile_media_error = '';
			is_saving_profile_media = true;
			close_image_editor({ reset_inputs: false });
			profile_image_form.requestSubmit();
			return;
		}

		if (editor.mode === 'cover' && cover_image_input && cover_image_form) {
			cover_image_input.files = transfer.files;
			profile_media_error = '';
			is_saving_profile_media = true;
			close_image_editor({ reset_inputs: false });
			cover_image_form.requestSubmit();
			return;
		}

		throw new Error('Upload form is unavailable.');
	}

	function clamp_video_trim_range(next_start: number, next_end: number) {
		const duration = post_video_duration_seconds;
		const bounded_start = Math.max(0, Math.min(next_start, Math.max(duration - 1, 0)));
		const min_end = Math.min(duration, bounded_start + 1);
		const bounded_end = Math.max(min_end, Math.min(next_end, duration));

		return {
			end_seconds: bounded_end,
			start_seconds: bounded_start
		};
	}

	function sync_video_trim_preview(focus: 'start' | 'end' = video_trim_preview_focus) {
		if (!video_editor_preview_element || !Number.isFinite(video_editor_preview_element.duration)) {
			return;
		}

		const preview_time =
			focus === 'start'
				? post_video_trim_start_seconds
				: Math.max(post_video_trim_start_seconds, post_video_trim_end_seconds - 0.05);

		video_editor_preview_element.pause();
		video_editor_preview_element.currentTime = Math.min(
			preview_time,
			video_editor_preview_element.duration
		);
	}

	function update_video_trim_range(next_start: number, next_end: number, focus: 'start' | 'end') {
		if (is_applying_image_editor) {
			return;
		}

		const trimmed = clamp_video_trim_range(next_start, next_end);
		post_video_trim_start_seconds = trimmed.start_seconds;
		post_video_trim_end_seconds = trimmed.end_seconds;
		video_trim_preview_focus = focus;
		sync_video_trim_preview(focus);
	}

	function adjust_video_trim_point(focus: 'start' | 'end', delta_seconds: number) {
		if (focus === 'start') {
			update_video_trim_range(
				Math.round(post_video_trim_start_seconds + delta_seconds),
				post_video_trim_end_seconds,
				'start'
			);
			return;
		}

		update_video_trim_range(
			post_video_trim_start_seconds,
			Math.round(post_video_trim_end_seconds + delta_seconds),
			'end'
		);
	}

	function handle_video_trim_start_input(event: Event) {
		const next_start = Number((event.currentTarget as HTMLInputElement).value);
		update_video_trim_range(next_start, post_video_trim_end_seconds, 'start');
	}

	function handle_video_trim_end_input(event: Event) {
		const next_end = Number((event.currentTarget as HTMLInputElement).value);
		update_video_trim_range(post_video_trim_start_seconds, next_end, 'end');
	}

	type SignedVideoUploadResponse = {
		apiKey: string;
		cloudName: string;
		params: Record<string, number | string | string[]>;
		publicId: string;
		signature: string;
		uploadUrl: string;
	};

	type CloudinaryVideoUploadResponse = {
		bytes?: number;
		error?: {
			message?: string;
		};
		public_id?: string;
		secure_url?: string;
	};

	type PreparedVideoPost = {
		caption: string;
		file: File;
		trim_end_seconds: number;
		trim_start_seconds: number;
		video_duration_seconds: number;
	};

	async function get_signed_video_upload(
		file: File,
		trim: {
			trim_end_seconds: number;
			trim_start_seconds: number;
			video_duration_seconds: number;
		}
	): Promise<SignedVideoUploadResponse> {
		const response = await fetch('/api/uploads/video-signature', {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				file_size: file.size,
				file_type: file.type,
				profile_username: data['profile'].username,
				trim_end_seconds: trim.trim_end_seconds,
				trim_start_seconds: trim.trim_start_seconds,
				video_duration_seconds: trim.video_duration_seconds
			})
		});

		const payload = (await response.json()) as Partial<SignedVideoUploadResponse> & {
			message?: string;
		};

		if (!response.ok) {
			throw new Error(payload.message ?? 'Video upload could not be prepared.');
		}

		if (
			typeof payload.apiKey !== 'string' ||
			typeof payload.signature !== 'string' ||
			typeof payload.uploadUrl !== 'string' ||
			typeof payload.publicId !== 'string' ||
			!payload.params
		) {
			throw new Error('Video upload could not be prepared.');
		}

		return payload as SignedVideoUploadResponse;
	}

	function get_cloudinary_upload_id() {
		return typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}

	function build_cloudinary_upload_form_data(
		signed_upload: SignedVideoUploadResponse,
		file_part: Blob,
		file_name: string
	) {
		const upload_form_data = new FormData();

		for (const [key, value] of Object.entries(signed_upload.params)) {
			if (Array.isArray(value)) {
				upload_form_data.set(key, value.join(','));
				continue;
			}

			upload_form_data.set(key, String(value));
		}

		upload_form_data.set('api_key', signed_upload.apiKey);
		upload_form_data.set('signature', signed_upload.signature);
		upload_form_data.set('file', file_part, file_name);

		return upload_form_data;
	}

	function parse_cloudinary_upload_response(
		request: XMLHttpRequest,
		file: File
	): CloudinaryVideoUploadResponse {
		let payload: CloudinaryVideoUploadResponse;

		try {
			payload = JSON.parse(request.responseText || '{}') as CloudinaryVideoUploadResponse;
		} catch (error) {
			console.error('Cloudinary video upload response could not be parsed', {
				error,
				file_size: file.size,
				response_text: request.responseText,
				status: request.status
			});
			throw new Error('Video upload failed. Please try again.', { cause: error });
		}

		if ((request.status < 200 || request.status >= 300) && !payload.error?.message) {
			console.error('Cloudinary video upload failed without a readable error message', {
				file_size: file.size,
				response_text: request.responseText,
				status: request.status
			});
			throw new Error('Video upload failed. Please try again.');
		}

		return payload;
	}

	function upload_cloudinary_video_part(params: {
		file: File;
		file_part: Blob;
		on_progress: (loaded_bytes: number) => void;
		signed_upload: SignedVideoUploadResponse;
		content_range?: string;
		upload_id?: string;
	}): Promise<CloudinaryVideoUploadResponse> {
		const { content_range, file, file_part, on_progress, signed_upload, upload_id } = params;
		const upload_form_data = build_cloudinary_upload_form_data(signed_upload, file_part, file.name);

		return new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();
			active_video_upload_xhr = request;

			request.upload.onprogress = (event) => {
				if (!event.lengthComputable || event.total <= 0) {
					return;
				}

				on_progress(event.loaded);
			};

			request.onload = () => {
				active_video_upload_xhr = undefined;

				try {
					const payload = parse_cloudinary_upload_response(request, file);
					resolve(payload);
				} catch (error) {
					reject(error);
				}
			};

			request.onerror = () => {
				active_video_upload_xhr = undefined;
				reject(new Error('Video upload failed. Please try again.'));
			};

			request.onabort = () => {
				active_video_upload_xhr = undefined;
				reject(new DOMException('Video upload cancelled.', 'AbortError'));
			};

			request.open('POST', signed_upload.uploadUrl);

			if (content_range && upload_id) {
				request.setRequestHeader('Content-Range', content_range);
				request.setRequestHeader('X-Unique-Upload-Id', upload_id);
			}

			request.send(upload_form_data);
		});
	}

	async function upload_to_cloudinary_in_single_request(
		signed_upload: SignedVideoUploadResponse,
		file: File,
		on_progress: (progress_percent: number) => void
	): Promise<CloudinaryVideoUploadResponse> {
		const payload = await upload_cloudinary_video_part({
			file,
			file_part: file,
			on_progress: (loaded_bytes) => {
				on_progress(Math.min(99, Math.round((loaded_bytes / file.size) * 100)));
			},
			signed_upload
		});

		on_progress(100);
		return payload;
	}

	async function upload_to_cloudinary_in_chunks(
		signed_upload: SignedVideoUploadResponse,
		file: File,
		on_progress: (progress_percent: number) => void
	): Promise<CloudinaryVideoUploadResponse> {
		const upload_id = get_cloudinary_upload_id();
		let uploaded_bytes = 0;
		let last_payload: CloudinaryVideoUploadResponse = {};

		while (uploaded_bytes < file.size) {
			const chunk_start = uploaded_bytes;
			const chunk_end_exclusive = Math.min(chunk_start + CLOUDINARY_VIDEO_CHUNK_BYTES, file.size);
			const chunk_end = chunk_end_exclusive - 1;
			const file_part = file.slice(chunk_start, chunk_end_exclusive);

			last_payload = await upload_cloudinary_video_part({
				content_range: `bytes ${chunk_start}-${chunk_end}/${file.size}`,
				file,
				file_part,
				on_progress: (chunk_loaded_bytes) => {
					const total_loaded_bytes = Math.min(
						file.size,
						chunk_start + Math.min(chunk_loaded_bytes, file_part.size)
					);
					on_progress(Math.min(99, Math.round((total_loaded_bytes / file.size) * 100)));
				},
				signed_upload,
				upload_id
			});

			if (last_payload.error) {
				return last_payload;
			}

			uploaded_bytes = chunk_end_exclusive;
		}

		on_progress(100);
		return last_payload;
	}

	function upload_to_cloudinary_with_progress(
		signed_upload: SignedVideoUploadResponse,
		file: File,
		on_progress: (progress_percent: number) => void
	): Promise<CloudinaryVideoUploadResponse> {
		if (file.size > CLOUDINARY_CHUNKED_VIDEO_THRESHOLD_BYTES) {
			return upload_to_cloudinary_in_chunks(signed_upload, file, on_progress);
		}

		return upload_to_cloudinary_in_single_request(signed_upload, file, on_progress);
	}

	async function upload_direct_trimmed_video(
		file: File,
		trim: {
			trim_end_seconds: number;
			trim_start_seconds: number;
			video_duration_seconds: number;
		},
		on_progress: (progress_percent: number) => void = () => {}
	) {
		const signed_upload = await get_signed_video_upload(file, trim);
		const payload = await upload_to_cloudinary_with_progress(signed_upload, file, on_progress);

		if (payload.error) {
			throw new Error(payload.error?.message || 'Video upload failed. Please try again.');
		}

		if (
			typeof payload.public_id !== 'string' ||
			typeof payload.secure_url !== 'string' ||
			payload.public_id !== signed_upload.publicId
		) {
			throw new Error('Video upload could not be verified. Please try again.');
		}

		return {
			publicId: payload.public_id,
			secureUrl: payload.secure_url
		};
	}

	async function save_uploaded_video_post(params: {
		caption: string;
		public_id: string;
		secure_url: string;
		trim_end_seconds: number;
		trim_start_seconds: number;
		video_duration_seconds: number;
		create_post_action_url: string;
	}) {
		const form_data = new FormData();
		form_data.set('caption', params.caption);
		form_data.set('media_type', 'video');
		form_data.set('media_public_id', params.public_id);
		form_data.set('media_secure_url', params.secure_url);
		form_data.set('trim_start_seconds', String(params.trim_start_seconds));
		form_data.set('trim_end_seconds', String(params.trim_end_seconds));
		form_data.set('video_duration_seconds', String(params.video_duration_seconds));

		active_video_post_abort_controller = new AbortController();

		try {
			const response = await fetch(params.create_post_action_url, {
				method: 'POST',
				body: form_data,
				signal: active_video_post_abort_controller.signal
			});

			if (!response.ok) {
				throw new Error('Video uploaded, but the post could not be saved. Please try again.');
			}
		} finally {
			active_video_post_abort_controller = undefined;
		}
	}

	async function start_background_video_post(post: PreparedVideoPost) {
		const create_post_action_url = `${page.url.pathname}?/create_post`;

		background_video_post = {
			file_name: post.file.name,
			progress_percent: 0,
			status: 'uploading'
		};
		sync_background_video_post_store();

		upload_modal_open = false;
		submitting_post = false;
		caption = '';
		upload_media_error = '';
		clear_post_preview();

		try {
			const uploaded_video = await upload_direct_trimmed_video(
				post.file,
				{
					trim_end_seconds: post.trim_end_seconds,
					trim_start_seconds: post.trim_start_seconds,
					video_duration_seconds: post.video_duration_seconds
				},
				(progress_percent) => {
					if (!background_video_post || background_video_post.status !== 'uploading') {
						return;
					}

					background_video_post.progress_percent = progress_percent;
					sync_background_video_post_store();
				}
			);

			if (!background_video_post) {
				return;
			}

			background_video_post.status = 'saving';
			background_video_post.progress_percent = 100;
			sync_background_video_post_store();

			await save_uploaded_video_post({
				caption: post.caption,
				create_post_action_url,
				public_id: uploaded_video.publicId,
				secure_url: uploaded_video.secureUrl,
				trim_end_seconds: post.trim_end_seconds,
				trim_start_seconds: post.trim_start_seconds,
				video_duration_seconds: post.video_duration_seconds
			});

			if (!background_video_post) {
				return;
			}

			background_video_post.status = 'complete';
			sync_background_video_post_store();
			await invalidateAll();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				background_video_post = undefined;
				sync_background_video_post_store();
				return;
			}

			if (background_video_post) {
				background_video_post.status = 'error';
				background_video_post.error_message = get_apply_error_message(
					error,
					'Video upload failed. Please try again.'
				);
				sync_background_video_post_store();
			}
		}
	}

	function cancel_background_video_post() {
		if (
			!background_video_post ||
			(background_video_post.status !== 'uploading' && background_video_post.status !== 'saving')
		) {
			return;
		}

		is_background_video_cancel_confirming = true;
		sync_background_video_post_store();
	}

	function keep_background_video_post_uploading() {
		is_background_video_cancel_confirming = false;
		sync_background_video_post_store();
	}

	function confirm_cancel_background_video_post() {
		if (
			!background_video_post ||
			(background_video_post.status !== 'uploading' && background_video_post.status !== 'saving')
		) {
			is_background_video_cancel_confirming = false;
			return;
		}

		active_video_upload_xhr?.abort();
		active_video_post_abort_controller?.abort();
		background_video_post = undefined;
		is_background_video_cancel_confirming = false;
		sync_background_video_post_store();
	}

	function dismiss_background_video_post() {
		if (
			background_video_post?.status === 'uploading' ||
			background_video_post?.status === 'saving'
		) {
			return;
		}

		background_video_post = undefined;
		is_background_video_cancel_confirming = false;
		sync_background_video_post_store();
	}

	function begin_applying_image_editor() {
		is_applying_image_editor = true;
		stop_image_editor_zoom_step();
		image_editor_drag_state = undefined;
		image_editor_error = '';
	}

	function get_apply_error_message(error: unknown, fallback: string) {
		return error instanceof Error ? error.message : fallback;
	}

	function validate_video_editor_range() {
		if (post_video_trim_end_seconds <= post_video_trim_start_seconds) {
			return 'Choose a valid start and end time for the video clip.';
		}

		if (estimated_trimmed_video_bytes > MAX_POST_VIDEO_OUTPUT_BYTES) {
			return `Trim more to get the estimated clip size down to ${video_upload_size_label} or less before posting.`;
		}

		return '';
	}

	async function apply_video_editor() {
		const validation_message = validate_video_editor_range();

		if (validation_message) {
			image_editor_error = validation_message;
			return;
		}

		video_editor_preview_element?.pause();

		if (!post_editor_source_file) {
			image_editor_error = 'Please choose the video again.';
			return;
		}

		const next_video_src = image_editor?.src ?? '';
		if (video_src && video_src !== next_video_src) {
			URL.revokeObjectURL(video_src);
		}

		selected_video = post_editor_source_file;
		selected_image = undefined;
		direct_video_public_id = '';
		direct_video_secure_url = '';
		video_src = next_video_src;
		image_src = '';
		image_editor_object_url = '';
		close_image_editor({ reset_inputs: false });
	}

	async function apply_crop_editor(editor: NonNullable<typeof image_editor>) {
		const frame = get_image_editor_frame_size();
		const scale = get_image_editor_scale();

		if (!frame || !scale) {
			image_editor_error = 'Preview is still loading. Please try again.';
			return;
		}

		begin_applying_image_editor();

		try {
			const blob = await create_editor_blob(editor, frame, scale);
			submit_cropped_editor_file(editor, blob);
		} catch (error) {
			image_editor_error = get_apply_error_message(
				error,
				'Unable to prepare that image right now.'
			);
			is_applying_image_editor = false;
		}
	}

	async function apply_image_editor() {
		if (is_applying_image_editor) {
			return;
		}

		const editor = image_editor;

		if (!editor) {
			return;
		}

		if (editor.mode === 'video-post') {
			await apply_video_editor();
			return;
		}

		await apply_crop_editor(editor);
	}

	async function handle_return_navigation() {
		if (return_to) {
			const separator = return_to.includes('?') ? '&' : '?';
			const target_href = return_post_id
				? `${return_to}${separator}focusPost=${encodeURIComponent(return_post_id)}`
				: return_to;
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(target_href);
			return;
		}

		if (window.history.length > 1) {
			window.history.back();
			return;
		}

		await goto(resolve('/home'));
	}

	async function handle_relationship_button_click() {
		if (data['relationship'].is_own_profile) {
			return;
		}

		const hasfollowing_before_request = isrelationship_following;
		const previous_followers_count = profile_followers_count;
		const isnext_following = !isrelationship_following;
		isrelationship_following = isnext_following;
		profile_followers_count = Math.max(0, profile_followers_count + (isnext_following ? 1 : -1));

		const action = isnext_following ? '?/follow' : '?/unfollow';
		relationship_sync_queue = relationship_sync_queue
			.then(async () => {
				const action_form_data = new FormData();
				const response = await fetch(action, {
					method: 'POST',
					body: action_form_data,
					headers: {
						'x-sveltekit-action': 'true'
					},
					credentials: 'same-origin'
				});

				if (!response.ok || response.redirected) {
					isrelationship_following = hasfollowing_before_request;
					profile_followers_count = previous_followers_count;
					console.warn('Relationship sync request failed.');
				}
			})
			.catch(() => {
				isrelationship_following = hasfollowing_before_request;
				profile_followers_count = previous_followers_count;
				console.warn('Relationship sync request failed.');
			});
	}

	async function handle_share_profile_click() {
		const profile_url = window.location.href;

		try {
			if (navigator.share) {
				await navigator.share({
					title: `${profile_display_name} (@${data['profile'].username})`,
					text: `Check out ${profile_display_name}'s profile`,
					url: profile_url
				});
				share_feedback = 'Profile link shared.';
			} else {
				await navigator.clipboard.writeText(profile_url);
				share_feedback = 'Profile link copied.';
			}
		} catch {
			try {
				await navigator.clipboard.writeText(profile_url);
				share_feedback = 'Profile link copied.';
			} catch {
				share_feedback = 'Unable to share profile link.';
			}
		}

		setTimeout(() => {
			share_feedback = '';
		}, 2500);
	}

	onDestroy(() => {
		clear_post_preview();
		clear_image_editor_drag_hint_timeout();
		stop_image_editor_zoom_step();

		if (image_editor_object_url) {
			URL.revokeObjectURL(image_editor_object_url);
		}
	});
</script>

<svelte:head>
	<title>Profile | Space and Time</title>
	<link rel="preload" as="image" href={profile_cover_source.src} fetchpriority="high" />
	{#if profile_avatar}
		<link
			rel="preload"
			as="image"
			href={profile_avatar_source?.src ?? profile_avatar}
			fetchpriority="high"
		/>
	{/if}
</svelte:head>

<div
	class="profile-scroll flex h-[calc(100dvh-4.5rem)] justify-center overflow-y-auto overscroll-x-none overscroll-y-none bg-[#0a0b1e] text-white md:h-screen"
>
	<div
		class="flex min-h-full w-full max-w-6xl flex-col px-2 pt-2 pb-40 shadow-2xl md:min-h-screen md:p-2"
	>
		<div class="relative h-56 w-full md:h-74">
			{#if return_to}
				<button
					type="button"
					onclick={() => {
						void handle_return_navigation();
					}}
					class="absolute top-4 left-4 z-40 block transition-transform duration-200 hover:scale-105 md:top-6 md:left-6"
					aria-label="Go back"
				>
					<img
						src="/images/profile/go-back-icon.avif"
						alt=""
						class="h-10 w-10 object-contain md:h-12 md:w-12"
					/>
				</button>
			{/if}
			<div class="relative h-full w-full overflow-hidden rounded-3xl">
				<ProgressiveImage
					src={profile_cover_source.src}
					srcset={profile_cover_source.srcset}
					sizes="(max-width: 768px) 100vw, 960px"
					alt="Cover"
					wrapper_class="h-full w-full"
					img_class="h-full w-full object-cover"
					skeleton_class="rounded-3xl"
					loading="eager"
					decoding="async"
					fetchpriority="high"
				/>

				{#if data['relationship'].is_own_profile}
					<form
						bind:this={cover_image_form}
						method="post"
						action="?/update_cover_image"
						enctype="multipart/form-data"
						onsubmit={(event) => handle_profile_media_submit(event, 'Cover photo')}
						class="absolute inset-0 z-20"
					>
						<div
							role="button"
							tabindex="0"
							onclick={() => {
								open_image_actions_menu('cover', profile_cover_source.src, 'Cover', false);
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									open_image_actions_menu('cover', profile_cover_source.src, 'Cover', false);
								}
							}}
							class="group relative block h-full w-full cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.01] active:scale-[0.995]"
							aria-label="Open cover image actions"
						>
							<span
								class="pointer-events-none absolute inset-0 transition-all duration-200 ease-out {is_editing_profile
									? 'bg-black/35 backdrop-blur-[2px] group-hover:bg-black/45 group-active:bg-black/50'
									: 'bg-black/0 group-hover:bg-black/12 group-active:bg-black/18'}"
							></span>
							{#if is_editing_profile}
								<span
									class="pointer-events-none absolute inset-0 grid place-items-center text-3xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-4xl"
									aria-hidden="true">✎</span
								>
							{/if}
						</div>
						<input
							bind:this={cover_image_input}
							id="cover-image-upload"
							type="file"
							name="cover"
							accept="image/*"
							class="sr-only"
							onchange={handle_cover_image_change}
						/>
					</form>
				{:else}
					<button
						type="button"
						onclick={() => {
							open_image_preview(profile_cover_source.src, 'Cover', false);
						}}
						class="absolute inset-0 z-20 block cursor-zoom-in"
						aria-label="Open cover image preview"
					></button>
				{/if}
			</div>

			<div
				class="absolute -bottom-14 left-1/2 z-30 h-32 w-32 -translate-x-1/2 md:-bottom-20 md:h-48 md:w-48"
			>
				{#if data['profile'].image}
					<div
						class="relative z-10 h-full w-full overflow-hidden rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] lg:border-7"
					>
						<ProgressiveImage
							src={profile_avatar_source?.src ?? data['profile'].image}
							srcset={profile_avatar_source?.srcset}
							sizes="(max-width: 768px) 128px, 192px"
							alt={data['profile'].name
								? `${data['profile'].name} avatar`
								: `${data['profile'].username} avatar`}
							wrapper_class="h-full w-full rounded-full"
							img_class="h-full w-full rounded-full object-cover"
							skeleton_class="rounded-full"
							loading="eager"
							decoding="async"
							fetchpriority="high"
						/>
					</div>
				{:else}
					<div
						class="relative z-10 flex h-full w-full items-center justify-center rounded-full border-5 border-[#0a0b1e] bg-[#1b1c31] text-5xl font-bold text-slate-300 lg:border-7"
					>
						{data['profile'].username.slice(0, 1).toUpperCase()}
					</div>
				{/if}

				{#if data['relationship'].is_own_profile}
					<form
						bind:this={profile_image_form}
						method="post"
						action="?/update_profile_image"
						enctype="multipart/form-data"
						onsubmit={(event) => handle_profile_media_submit(event, 'Profile photo')}
						class="absolute inset-0 z-30"
					>
						<div
							role="button"
							tabindex="0"
							onclick={() => {
								open_image_actions_menu(
									'avatar',
									profile_avatar_source?.src ?? data['profile'].image ?? undefined,
									data['profile'].name
										? `${data['profile'].name} avatar`
										: `${data['profile'].username} avatar`,
									true
								);
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									open_image_actions_menu(
										'avatar',
										profile_avatar_source?.src ?? data['profile'].image ?? undefined,
										data['profile'].name
											? `${data['profile'].name} avatar`
											: `${data['profile'].username} avatar`,
										true
									);
								}
							}}
							class="group relative block h-full w-full cursor-pointer rounded-full transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.97]"
							aria-label="Open profile picture actions"
						>
							<span
								class="pointer-events-none absolute inset-0 rounded-full transition-all duration-200 ease-out {is_editing_profile
									? 'bg-black/35 backdrop-blur-[2px] group-hover:bg-black/45 group-active:bg-black/50'
									: 'bg-black/0 group-hover:bg-black/12 group-active:bg-black/18'}"
							></span>
							{#if is_editing_profile}
								<span
									class="pointer-events-none absolute inset-0 grid place-items-center text-3xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-4xl"
									aria-hidden="true">✎</span
								>
							{/if}
						</div>
						<input
							bind:this={profile_image_input}
							id="profile-image-upload"
							type="file"
							name="avatar"
							accept="image/*"
							class="sr-only"
							onchange={handle_profile_image_change}
						/>
					</form>
				{:else if profile_avatar_source?.src ?? data['profile'].image}
					<button
						type="button"
						onclick={() => {
							open_image_preview(
								profile_avatar_source?.src ?? data['profile'].image ?? '',
								data['profile'].name
									? `${data['profile'].name} avatar`
									: `${data['profile'].username} avatar`,
								true
							);
						}}
						class="absolute inset-0 z-30 block cursor-zoom-in rounded-full"
						aria-label="Open profile picture preview"
					></button>
				{/if}

				{#if data['relationship'].is_own_profile}
					<!-- <button
						type="button"
						onclick={handle_relationship_button_click}
						class="absolute top-10 -left-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-left-25 md:-left-30 md:shadow-md lg:-left-45 lg:h-15 lg:w-15 xl:-left-70"
						style={`background:${relationship_background_style};${relationship_followed_effect_style}`}
					>
						<img
							src={relationship_icon_source}
							alt="Add"
							class="h-6 w-6 object-contain pl-1 lg:h-9 lg:w-9"
						/>
					</button> -->
				{:else}
					<!-- <button
						class="absolute top-10 -left-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-left-25 md:-left-30 md:shadow-md lg:-left-45 lg:h-15 lg:w-15 xl:-left-70"
					>
						<img
							src={profile_icons.message}
							alt="Message"
							class="h-5 w-5 object-contain lg:h-9 lg:w-9"
						/>
					</button> -->
				{/if}

				{#if !is_editing_profile}
					<button
						type="button"
						onclick={() => {
							void handle_share_profile_click();
						}}
						class="absolute bottom-5 -left-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-left-12 sm:z-20 md:-left-15 md:z-20 md:shadow-md lg:-left-25 lg:h-15 lg:w-15 xl:-left-40"
					>
						<img
							src={profile_icons.share}
							alt="Share"
							class="h-5 w-5 object-contain pr-1 lg:h-8 lg:w-8"
						/>
					</button>
				{/if}

				{#if data['relationship'].is_own_profile && !is_editing_profile}
					<button
						type="button"
						onclick={start_profile_editing}
						class="absolute -right-20 bottom-5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-right-12 md:-right-15 md:shadow-md lg:-right-25 lg:h-15 lg:w-15 xl:-right-40"
						aria-label="Edit profile"
					>
						<img
							src={profile_icons.edit}
							alt="Edit"
							class="h-5 w-5 object-contain pl-1 lg:h-9 lg:w-9"
						/>
					</button>
				{:else if !is_editing_profile}
					<button
						type="button"
						onclick={handle_relationship_button_click}
						class="absolute -right-20 bottom-5 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-right-12 md:-right-15 md:shadow-md lg:-right-25 lg:h-15 lg:w-15 xl:-right-40"
						style={`background:${relationship_background_style};${relationship_followed_effect_style}`}
					>
						<img
							src={relationship_icon_source}
							alt={isrelationship_following ? 'Unfollow' : 'Follow'}
							class="h-6 w-6 object-contain pl-1 lg:h-9 lg:w-9"
						/>
					</button>
				{/if}

				<!-- {#if data['relationship'].is_own_profile}
				<button
					class="absolute top-10 -right-40 z-20 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-purple-500/30 bg-[#3F2C56] shadow shadow-white backdrop-blur-sm transition-transform hover:scale-110 max-[479px]:-right-25 md:-right-30 md:shadow-md lg:-right-45 lg:h-15 lg:w-15 xl:-right-70"
				>
					<img
						src={profile_icons.settings}
						alt="Settings"
						class="h-6 w-6 object-contain lg:h-8 lg:w-8"
					/>
				</button>
				{/if} -->
			</div>
		</div>

		<form method="post" action="?/update_profile_details" class="contents">
			<div
				class="profile-identity-frame mt-16 text-center md:mt-30 {is_editing_profile
					? 'profile-identity-frame-edit'
					: ''}"
			>
				{#if is_editing_profile}
					<div class="profile-identity-state profile-identity-edit">
						<label class="profile-inline-edit-label mx-auto block">
							<span class="profile-edit-pencil text-lg text-sky-300" aria-hidden="true">✎</span>
							<input
								name="name"
								bind:value={edit_profile_name}
								minlength="3"
								maxlength="15"
								required
								aria-describedby="edit-profile-name-requirements"
								oninput={apply_profile_name_validation}
								oninvalid={apply_profile_name_validation}
								class="profile-inline-edit-name"
								aria-label="Profile nickname"
							/>
							<span id="edit-profile-name-requirements" class="sr-only">
								Nickname must be 3 to 15 characters, can include letters and numbers, may have at
								most one space and one underscore, and must include at least one letter.
							</span>
						</label>
						<label class="profile-inline-edit-label mx-auto mt-0.5 block">
							<span class="profile-edit-pencil text-base text-sky-300" aria-hidden="true">✎</span>
							<span
								class="pointer-events-none absolute top-1/2 left-9 z-10 -translate-y-1/2 text-sm text-slate-400"
								aria-hidden="true">@</span
							>
							<input
								name="username"
								bind:value={edit_profile_username}
								minlength="3"
								maxlength="15"
								required
								aria-describedby="edit-profile-username-requirements"
								oninput={apply_profile_username_validation}
								oninvalid={apply_profile_username_validation}
								class="profile-inline-edit-username"
								aria-label="Profile username"
							/>
							<span id="edit-profile-username-requirements" class="sr-only">
								Username must be 3 to 15 characters, can include letters and numbers, may have at
								most one space and one underscore, and must include at least one letter.
							</span>
						</label>
					</div>
				{:else}
					<div class="profile-identity-state profile-identity-display">
						<h1 class="text-2xl font-bold tracking-wide md:text-3xl">
							{data['profile'].name ?? data['profile'].username}
						</h1>
						<p class="md:text-md text-sm text-slate-400">@{data['profile'].username}</p>
					</div>
				{/if}
			</div>
			{#if share_feedback}
				<p class="mt-3 text-center text-xs font-medium text-sky-300">{share_feedback}</p>
			{/if}
			{#if profile_media_error}
				<p
					class="mx-6 mt-4 rounded-xl border border-amber-300/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100"
					aria-live="polite"
				>
					{profile_media_error}
				</p>
			{/if}

			{#if form_message}
				<p
					class="mx-6 mt-4 rounded-xl border px-4 py-3 text-sm {success_message
						? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
						: 'border-rose-400/40 bg-rose-500/15 text-rose-100'}"
				>
					{form_message}
				</p>
			{/if}

			{#if !is_editing_profile}
				<div
					class="mx-auto mt-6 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-6 md:gap-10"
				>
					<div class="text-center">
						<div class="text-2xl font-bold text-sky-400">{data['stats'].post_count}</div>
						<div class="text-xs tracking-wider text-slate-500 uppercase">Posts</div>
					</div>

					<div class="h-8 w-px bg-slate-700"></div>

					<div class="text-center">
						<div class="text-2xl font-bold text-sky-400">{profile_followers_count}</div>
						<div class="text-xs tracking-wider text-slate-500 uppercase">Followers</div>
					</div>

					<div class="h-8 w-px bg-slate-700"></div>

					<div class="text-center">
						<div class="text-2xl font-bold text-sky-400">{data['stats'].following_count}</div>
						<div class="text-xs tracking-wider text-slate-500 uppercase">Following</div>
					</div>
				</div>
			{/if}

			<div
				class="relative mx-2 {is_editing_profile
					? 'mt-5'
					: 'mt-6'} rounded-3xl bg-[#121324] p-4 min-[420px]:p-5 md:p-6"
			>
				<div
					class="absolute inset-0 rounded-3xl bg-linear-to-r from-[#CD82FF] via-[#FF0DA6] to-[#C575E3] p-px"
				>
					<div class="h-full w-full rounded-3xl bg-[#121324]"></div>
				</div>

				<span
					class="absolute -top-3 left-6 z-10 rounded-2xl bg-[#0a0b1e] px-3 text-xs font-semibold tracking-wide text-purple-400"
				>
					ABOUT
				</span>

				{#if is_editing_profile}
					<div class="about-edit-panel">
						<div class="relative z-10 mt-2">
							<label
								for="edit-profile-bio"
								class="block text-xs font-semibold tracking-wide text-slate-400 uppercase"
							>
								Bio
							</label>
							<textarea
								id="edit-profile-bio"
								name="bio"
								bind:value={edit_profile_bio}
								maxlength="200"
								rows="4"
								placeholder="Write a short bio"
								oninput={apply_profile_bio_validation}
								oninvalid={apply_profile_bio_validation}
								class="mt-2 w-full resize-none rounded-2xl border border-white/12 bg-white/8 px-3 py-2.5 text-sm leading-5 text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/70 min-[420px]:px-4 min-[420px]:py-3"
							></textarea>
							<div class="mt-1 flex items-center justify-between gap-2">
								<div class="flex gap-1.5">
									<button
										type="button"
										onclick={() => {
											edit_profile_bio = '';
										}}
										class="about-field-action"
									>
										Clear
									</button>
									<button
										type="button"
										onclick={() => {
											reset_profile_about_field('bio');
										}}
										class="about-field-action"
									>
										Reset
									</button>
								</div>
								<p class="text-[11px] text-slate-500">{edit_profile_bio.length}/200</p>
							</div>
						</div>

						<div
							class="relative z-10 mt-3 grid gap-2.5 text-xs text-slate-300 min-[420px]:mt-4 min-[420px]:gap-3 md:grid-cols-2"
						>
							<div class="profile-email-edit-row flex items-center gap-2">
								<img
									src={edit_profile_location.trim() ? about_icons.location : about_icons.add}
									alt=""
									class="h-4 w-4 shrink-0"
								/>
								<input
									name="location"
									bind:value={edit_profile_location}
									maxlength="80"
									placeholder="Location"
									autocomplete="street-address"
									oninput={apply_profile_location_validation}
									oninvalid={apply_profile_location_validation}
									aria-describedby="edit-profile-location-requirements"
									class="w-full min-w-0 rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/70"
								/>
								<span id="edit-profile-location-requirements" class="sr-only">
									Address can be up to 80 characters and may include letters, numbers, spaces, and
									common address symbols.
								</span>
								<div class="flex shrink-0 gap-1">
									<button
										type="button"
										onclick={() => {
											edit_profile_location = '';
										}}
										class="about-field-icon-button"
										aria-label="Clear location"
										title="Clear location"
									>
										×
									</button>
									<button
										type="button"
										onclick={() => {
											reset_profile_about_field('location');
										}}
										class="about-field-icon-button"
										aria-label="Reset location"
										title="Reset location"
									>
										↺
									</button>
								</div>
							</div>

							<div class="flex items-center gap-2">
								<img
									src={edit_profile_email.trim() ? about_icons.email : about_icons.add}
									alt=""
									class="h-4 w-4 shrink-0"
								/>
								<span class="profile-email-edit-field relative min-w-0 flex-1">
									<input
										name="email"
										type="email"
										bind:value={edit_profile_email}
										maxlength="254"
										readonly
										tabindex="-1"
										placeholder="Email"
										class="profile-readonly-input pointer-events-none w-full min-w-0 cursor-not-allowed rounded-xl border border-white/12 py-2 pr-[6.7rem] pl-3 text-sm outline-none placeholder:text-slate-500"
									/>
									<label
										class="email-visibility-toggle absolute top-1/2 right-1.5 flex -translate-y-1/2 cursor-pointer items-center gap-1.5 px-1 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:text-white"
										title={edit_profile_email_visible
											? 'Email is visible to the public'
											: 'Email is hidden from the public'}
										aria-label="Toggle public email visibility"
									>
										<input
											type="checkbox"
											name="email_visible"
											bind:checked={edit_profile_email_visible}
											class="peer sr-only"
											disabled={!edit_profile_email.trim()}
										/>
										<span
											class="relative h-4 w-7 rounded-full bg-slate-600 transition-colors peer-checked:bg-sky-400"
											aria-hidden="true"
										>
											<span
												class="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3"
											></span>
										</span>
										<span class="w-9 text-left">
											{edit_profile_email_visible ? 'Public' : 'Hidden'}
										</span>
									</label>
								</span>
								<!-- Clear and Reset buttons removed for readonly email field -->
							</div>

							<div class="profile-phone-edit-row flex items-center gap-2 md:col-span-2">
								<img
									src={edit_profile_phone.trim() ? about_icons.phone : about_icons.add}
									alt=""
									class="h-4 w-4 shrink-0"
								/>
								<LanguageDropdown
									items={PROFILE_PHONE_COUNTRIES}
									bind:value={edit_profile_phone_country}
									on_change={handle_profile_phone_country_change}
									on_open_change={handle_phone_country_dropdown_open_change}
								/>

								<input
									name="phone"
									bind:value={edit_profile_phone}
									maxlength="32"
									placeholder={PROFILE_PHONE_COUNTRIES.find(
										(phone_country) => phone_country.country === edit_profile_phone_country
									)?.example ?? '+1-415-555-2671'}
									autocomplete="tel"
									inputmode="tel"
									oninput={handle_profile_phone_input}
									oninvalid={apply_profile_phone_validation}
									aria-describedby="edit-profile-phone-requirements"
									class="w-full min-w-0 rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/70"
								/>
								<input type="hidden" name="phone_country" bind:value={edit_profile_phone_country} />
								<span id="edit-profile-phone-requirements" class="sr-only">
									Choose US, Japan, or Cambodia. Phone numbers are automatically formatted for the
									selected country.
								</span>
								<div class="flex shrink-0 gap-1">
									<button
										type="button"
										onclick={() => {
											edit_profile_phone = '';
										}}
										class="about-field-icon-button"
										aria-label="Clear phone number"
										title="Clear phone number"
									>
										×
									</button>
									<button
										type="button"
										onclick={() => {
											reset_profile_about_field('phone');
										}}
										class="about-field-icon-button"
										aria-label="Reset phone number"
										title="Reset phone number"
									>
										↺
									</button>
								</div>
							</div>
						</div>

						<div
							class={`profile-edit-actions relative z-10 mt-4 grid grid-cols-2 gap-2.5 min-[420px]:mt-5 min-[420px]:gap-3 ${is_phone_country_dropdown_open ? 'pointer-events-none' : ''}`}
						>
							<button
								type="button"
								onclick={cancel_profile_editing}
								class="editor-action-secondary rounded-2xl px-4 py-2.5 text-sm font-semibold text-white/78 transition-all duration-180 hover:scale-[0.99] hover:bg-white/10 active:scale-[0.97] min-[420px]:py-3"
								transition:scale={{ duration: 160, start: 0.96, opacity: 0.65 }}
							>
								Cancel
							</button>
							<button
								type="submit"
								class="editor-action-primary rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#CD82FF] transition-all duration-180 hover:scale-[0.99] active:scale-[0.97] min-[420px]:py-3"
								transition:scale={{ duration: 160, start: 0.96, opacity: 0.65 }}
							>
								Save changes
							</button>
						</div>
					</div>
				{:else}
					<div>
						{#if data['profile'].bio}
							<p class="relative z-10 mt-1 text-sm whitespace-pre-wrap text-slate-200">
								{data['profile'].bio}
							</p>
						{:else if data['relationship'].is_own_profile}
							<div
								class="relative z-10 mt-1 flex items-center gap-2 text-sm font-medium text-sky-400"
							>
								<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add bio
							</div>
						{:else}
							<p class="relative z-10 mt-1 text-sm text-slate-400">No bio yet.</p>
						{/if}

						<div class="relative z-10 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
							{#if profile_about.location}
								<div class="flex items-center gap-2">
									<img src={about_icons.location} alt="Location" class="h-4 w-4" />
									{profile_about.location}
								</div>
							{:else if data['relationship'].is_own_profile}
								<div class="flex items-center gap-2 font-medium text-sky-400">
									<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add location
								</div>
							{/if}

							{#if profile_about.email}
								<div class="flex items-center gap-2 truncate">
									<img src={about_icons.email} alt="Email" class="h-4 w-4" />
									{profile_about.email}
								</div>
							{:else if data['relationship'].is_own_profile}
								<div class="flex items-center gap-2 font-medium text-sky-400">
									<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add email
								</div>
							{/if}

							{#if profile_about.phone}
								<div class="flex items-center gap-2">
									<img src={about_icons.phone} alt="Phone" class="h-4 w-4" />
									{profile_about.phone}
								</div>
							{:else if data['relationship'].is_own_profile}
								<div class="flex items-center gap-2 font-medium text-sky-400">
									<img src={about_icons.add} alt="Add" class="h-4 w-4" /> Add phone number
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</form>

		{#if !is_editing_profile}
			<div
				class="mt-4 flex items-center gap-1 rounded-full border-[3px] border-[#535060] bg-[#474555] p-1 text-xs font-bold md:mt-6 md:gap-2 md:border-[6px] md:p-1.5 md:text-sm"
			>
				<button
					type="button"
					onclick={() => {
						void set_active_profile_tab('posts');
					}}
					class="flex-1 cursor-pointer rounded-full border py-2 text-center text-white opacity-85 transition-all hover:opacity-100 md:border-2 md:py-3 {active_tab ===
					'posts'
						? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
						: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
				>
					Posts
				</button>
				<button
					type="button"
					onclick={() => {
						void set_active_profile_tab('videos');
					}}
					class="flex-1 cursor-pointer rounded-full border py-2 text-center text-white opacity-85 transition-all hover:opacity-100 md:border-2 md:py-3 {active_tab ===
					'videos'
						? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
						: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
				>
					Videos
				</button>
				<button
					type="button"
					onclick={() => {
						void set_active_profile_tab('shared');
					}}
					class="flex-1 cursor-pointer rounded-full border py-2 text-center text-white opacity-85 transition-all hover:opacity-100 md:border-2 md:py-3 {active_tab ===
					'shared'
						? 'border-[#E9A0F8] bg-linear-to-r from-[#62218D] via-[#62218D] to-[#E1B4FF] shadow-[0_0_15px_rgba(255,0,229,25)]'
						: 'border-[#7DD4FF] bg-linear-to-r from-[#4B7F99] via-[#7DD4FF] to-[#B9E8FF]'}"
				>
					Shared
				</button>
			</div>
		{/if}

		{#if !is_editing_profile && active_tab === 'posts'}
			<div class="mx-2 mt-2 grid grid-cols-3 gap-1 pb-10 md:gap-3 md:pb-8">
				{#if data['relationship'].is_own_profile}
					<button
						type="button"
						onclick={() => open_upload_modal('image')}
						class="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-purple-500/20 bg-linear-to-br from-[#7DD4FF] via-[#AAAAAA] to-[#CD82FF] transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<span class="text-5xl font-light text-white/70">+</span>
					</button>
				{/if}

				{#each post_tiles as post (post.id)}
					<a
						href={resolve(
							`/profile/${encodeURIComponent(data['profile'].username)}/posts/${post.id}`
						)}
						class="block aspect-square cursor-pointer overflow-hidden rounded-xl transition-transform hover:scale-[0.98] md:rounded-2xl"
						aria-label="Open post"
					>
						<ProgressiveImage
							src={post.image.src}
							srcset={post.image.srcset}
							sizes="(max-width: 768px) 33vw, (max-width: 1280px) 30vw, 360px"
							alt="Post"
							wrapper_class="h-full w-full"
							img_class="h-full w-full object-cover"
							skeleton_class="rounded-xl md:rounded-2xl"
							loading="lazy"
							decoding="async"
						/>
					</a>
				{/each}
			</div>
		{/if}

		{#if !is_editing_profile && active_tab === 'videos'}
			<div class="mx-2 mt-2 grid grid-cols-3 gap-1 pb-10 md:gap-3 md:pb-8">
				{#if data['relationship'].is_own_profile}
					<button
						type="button"
						onclick={() => open_upload_modal('video')}
						class="flex aspect-9/16 cursor-pointer items-center justify-center rounded-xl border border-purple-500/20 bg-linear-to-br from-[#7DD4FF] via-[#AAAAAA] to-[#CD82FF] transition-transform hover:scale-[0.98] md:rounded-2xl"
					>
						<span class="text-5xl font-light text-white/70">+</span>
					</button>
				{/if}

				{#each video_tiles as post (post.id)}
					<a
						href={resolve(
							`/profile/${encodeURIComponent(data['profile'].username)}/posts/${post.id}`
						)}
						class="block aspect-9/16 cursor-pointer overflow-hidden rounded-xl bg-black transition-transform hover:scale-[0.98] md:rounded-2xl"
						aria-label="Open video post"
					>
						<video
							src={post.video_url}
							poster={post.poster_url}
							class="h-full w-full object-cover"
							muted
							playsinline
							preload="metadata"
						></video>
					</a>
				{/each}
			</div>
		{/if}

		{#if !is_editing_profile && active_tab === 'shared'}
			<div class="mx-2 mt-2 grid grid-cols-3 gap-1 pb-10 md:gap-3 md:pb-8">
				{#each shared_post_tiles as post (post.id)}
					<a
						href={resolve(
							`/profile/${encodeURIComponent(data['profile'].username)}/shared/${post.id}`
						)}
						class="relative block aspect-square cursor-pointer overflow-hidden rounded-xl bg-black/30 transition-transform hover:scale-[0.98] md:rounded-2xl"
						aria-label="Open shared post"
					>
						{#if post.media_type === 'video' && post.media_url}
							<video
								src={post.media_url}
								poster={post.media_poster_url}
								class="h-full w-full object-cover"
								muted
								playsinline
								preload="metadata"
							></video>
							<span
								class="pointer-events-none absolute inset-0 grid place-items-center bg-black/10"
								aria-hidden="true"
							>
								<span
									class="relative grid h-9 w-9 place-items-center rounded-full bg-black/45 shadow-[0_8px_24px_rgba(0,0,0,0.3)] md:h-11 md:w-11"
								>
									<span
										class="ml-0.5 h-0 w-0 border-y-[7px] border-l-11 border-y-transparent border-l-white md:border-y-8 md:border-l-13"
									></span>
								</span>
							</span>
						{:else if post.image}
							<ProgressiveImage
								src={post.image.src}
								srcset={post.image.srcset}
								sizes="(max-width: 768px) 33vw, (max-width: 1280px) 30vw, 360px"
								alt="Shared post"
								wrapper_class="h-full w-full"
								img_class="h-full w-full object-cover"
								skeleton_class="rounded-xl md:rounded-2xl"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div
								class="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-white/70"
							>
								Shared post
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}

		{#if is_editing_profile}
			<div class="h-10 shrink-0 md:h-16" aria-hidden="true"></div>
		{/if}

		<div class="h-36 shrink-0 md:hidden" aria-hidden="true"></div>
	</div>
</div>

{#if upload_modal_open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm md:px-4"
		role="dialog"
		aria-modal="true"
		aria-busy={submitting_post}
		tabindex="0"
		bind:this={upload_modal_backdrop}
		transition:fade={{ duration: 180 }}
		onclick={(event) => {
			if (event.target === event.currentTarget && !submitting_post) {
				close_upload_modal();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape' && !submitting_post) {
				close_upload_modal();
			}
		}}
	>
		<div
			class="w-full rounded-[1.25rem] bg-linear-to-r from-[#7DD4FF] to-[#CD82FF] p-px transition-all duration-500 ease-in-out md:rounded-3xl {image_src ||
			video_src
				? 'max-w-4xl'
				: 'max-w-lg'}"
			inert={submitting_post}
			transition:scale={{ duration: 220, start: 0.94, opacity: 0.55 }}
		>
			<div
				class="flex max-h-[calc(100dvh-1rem)] w-full overflow-hidden rounded-[1.25rem] bg-[#1a1224] shadow-[0_0_5px_rgba(255,0,229,10)] md:max-h-[90vh] md:rounded-3xl"
			>
				<form
					method="post"
					action="?/create_post"
					enctype="multipart/form-data"
					onsubmit={handle_post_submit}
					class="flex flex-1 flex-col"
				>
					<input type="hidden" name="media_type" value={upload_media_type} />
					{#if upload_media_type === 'video'}
						<input type="hidden" name="media_public_id" value={direct_video_public_id} />
						<input type="hidden" name="media_secure_url" value={direct_video_secure_url} />
						<input
							type="hidden"
							name="trim_start_seconds"
							value={String(post_video_trim_start_seconds)}
						/>
						<input
							type="hidden"
							name="trim_end_seconds"
							value={String(post_video_trim_end_seconds)}
						/>
						<input
							type="hidden"
							name="video_duration_seconds"
							value={String(post_video_duration_seconds)}
						/>
					{/if}
					<div
						class="flex items-center justify-between border-b border-white/40 px-3 py-2 md:px-4 md:py-3"
					>
						<div class="w-5"></div>

						<h2 class="text-sm font-semibold text-white md:text-base">
							{upload_media_type === 'video' ? 'Create video post' : 'Create post'}
						</h2>

						<button
							type="button"
							onclick={close_upload_modal}
							class="editor-remove-action grid h-8 w-8 cursor-pointer place-items-center rounded-full text-base md:h-10 md:w-10 md:text-lg"
							disabled={submitting_post}
						>
							✕
						</button>
					</div>

					<div class="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
						{#if image_src || video_src}
							<div
								class="relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden border-b border-white/40 bg-[#18191a] p-2 min-[480px]:h-48 md:h-auto md:w-1/2 md:border-r md:border-b-0 md:p-6"
							>
								{#if upload_media_type === 'video' && video_src}
									<!-- svelte-ignore a11y_media_has_caption -->
									<video
										src={video_src}
										class="max-h-full w-auto max-w-full rounded-[1.1rem] object-contain md:rounded-[1.6rem]"
										controls
										playsinline
										preload="metadata"
									></video>
								{:else}
									<img
										src={image_src}
										alt="Preview"
										class="max-h-full w-auto max-w-full rounded-[1.1rem] object-contain md:rounded-[1.6rem]"
										decoding="async"
									/>
								{/if}

								<button
									type="button"
									onclick={remove_image}
									class="editor-remove-action absolute top-2 right-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full text-sm md:top-4 md:right-4 md:h-9 md:w-9 md:text-base"
									disabled={submitting_post}
								>
									✕
								</button>
							</div>
						{/if}

						<div
							class="flex w-full flex-1 flex-col p-3 md:p-4 {image_src || video_src
								? 'md:w-1/2'
								: ''}"
						>
							<div class="mb-2 flex items-center gap-2 md:mb-4 md:gap-3">
								<div
									class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-500 text-[11px] text-white md:h-10 md:w-10 md:text-xs"
								>
									{#if profile_avatar}
										<img
											src={profile_avatar_source?.src ?? profile_avatar}
											srcset={profile_avatar_source?.srcset}
											sizes="40px"
											alt={`${profile_display_name} avatar`}
											class="h-full w-full object-cover"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<span>{data['profile'].username.slice(0, 1).toUpperCase()}</span>
									{/if}
								</div>
								<div>
									<p class="text-xs font-semibold text-white md:text-sm">{profile_display_name}</p>
									<p class="text-xs text-slate-400">@{data['profile'].username}</p>
								</div>
							</div>

							<textarea
								id="upload-caption"
								name="caption"
								bind:value={caption}
								rows={image_src || video_src ? 6 : 4}
								placeholder="Write a caption..."
								readonly={submitting_post}
								class="min-h-18 w-full flex-1 resize-none border-0 bg-transparent p-0 text-white placeholder:text-slate-500 focus:ring-0 focus:outline-none md:min-h-28 {image_src ||
								video_src
									? 'text-sm'
									: 'text-base md:text-lg'}"
							></textarea>

							<div class="my-1.5 flex items-center justify-between text-slate-400 md:my-2">
								<span class="text-xs">{caption.length}/1000</span>
								{#if caption.length > 1000}
									<span class="text-xs text-rose-400">Caption exceeds maximum length!</span>
								{/if}
							</div>
							{#if post_validation_message}
								<p class="mb-2 text-sm text-amber-200" aria-live="polite">
									{post_validation_message}
								</p>
							{/if}
							{#if upload_media_error}
								<p class="mb-2 text-sm text-amber-200" aria-live="polite">
									{upload_media_error}
								</p>
							{/if}

							<label
								for={upload_media_type === 'video' ? 'video-upload' : 'file-upload'}
								class="mt-auto flex items-center justify-between rounded-lg border border-white/40 px-3 py-2 hover:bg-white/5 md:px-4 md:py-3 {submitting_post
									? 'cursor-not-allowed opacity-55'
									: 'cursor-pointer'}"
							>
								<span class="text-xs font-semibold text-white md:text-sm">
									{upload_media_type === 'video'
										? video_src
											? 'Video selected'
											: 'Add a video'
										: image_src
											? 'Photo selected'
											: 'Add a photo'}
								</span>

								<span class="rounded-full p-1 text-xl">🖼️</span>
							</label>
							{#if image_src || video_src}
								<button
									type="button"
									onclick={reopen_post_image_editor}
									class="mt-2 w-full rounded-xl bg-[linear-gradient(90deg,rgba(125,212,255,0.34)_0%,rgba(125,212,255,0.18)_52%,rgba(185,232,255,0.28)_100%)] px-4 py-2 text-xs font-semibold text-[#7DD4FF] shadow-[inset_1px_-1px_18px_0px_rgba(125,212,255,0.34),inset_0.5px_-0.5px_8px_0px_rgba(185,232,255,0.22),0_0_18px_rgba(125,212,255,0.24),0_12px_28px_rgba(0,0,0,0.24)] transition-transform hover:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 md:mt-3 md:py-3 md:text-sm"
									disabled={submitting_post}
								>
									{upload_media_type === 'video' ? 'Edit video' : 'Edit photo'}
								</button>
							{/if}
							{#if upload_media_type === 'video'}
								<input
									bind:this={post_video_input}
									id="video-upload"
									type="file"
									name="media"
									accept="video/mp4,video/quicktime,video/webm"
									class="sr-only"
									onchange={handle_video_file_change}
								/>
							{:else}
								<input
									bind:this={post_image_input}
									id="file-upload"
									type="file"
									name="media"
									accept="image/*"
									class="sr-only"
									onchange={handle_image_file_change}
								/>
							{/if}

							<button
								type="submit"
								class="mt-3 w-full cursor-pointer rounded-xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] py-2.5 text-sm font-semibold text-[#CD82FF] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-transform hover:scale-[0.98] md:mt-4 md:py-3 md:text-base {!has_selected_post_media ||
								caption.length > 1000 ||
								submitting_post
									? 'cursor-not-allowed opacity-50'
									: 'shadow-[0_0_10px_rgba(255,179,201,25)]'}"
								disabled={!has_selected_post_media || caption.length > 1000 || submitting_post}
							>
								{submitting_post ? 'Posting...' : 'Post'}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
		{#if submitting_post}
			<div
				class="absolute inset-0 z-80 grid cursor-wait place-items-center bg-black/38 backdrop-blur-[2px]"
				aria-live="polite"
			>
				<div
					class="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,7,24,0.9)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.38)]"
				>
					<span class="editor-processing-spinner" aria-hidden="true"></span>
					<span>Posting...</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

{#if image_actions}
	<div
		class="fixed inset-0 z-65 flex items-end justify-center bg-black/55 px-4 py-4 backdrop-blur-sm md:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Image actions"
		tabindex="0"
		bind:this={image_actions_backdrop}
		transition:fade={{ duration: 160 }}
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				close_image_actions_menu();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				close_image_actions_menu();
			}
		}}
	>
		<div
			class="w-full max-w-sm rounded-[1.75rem] border border-white/12 bg-[linear-gradient(145deg,rgba(16,12,35,0.98),rgba(8,7,24,0.98))] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:rounded-[1.6rem]"
			transition:scale={{ duration: 180, start: 0.96, opacity: 0.55 }}
		>
			<div class="mb-2 px-2 pt-1 pb-2 text-center">
				<p class="text-[11px] font-semibold tracking-[0.26em] text-sky-200/70 uppercase">
					{image_actions.mode === 'cover' ? 'Cover photo' : 'Profile photo'}
				</p>
			</div>

			<div class="grid gap-2">
				{#if image_actions.preview_src}
					<button
						type="button"
						onclick={preview_from_image_actions}
						class="rounded-[1.25rem] bg-[linear-gradient(90deg,rgba(125,212,255,0.34)_0%,rgba(125,212,255,0.18)_52%,rgba(185,232,255,0.28)_100%)] px-4 py-3.5 text-sm font-semibold text-[#7DD4FF] shadow-[inset_1px_-1px_18px_0px_rgba(125,212,255,0.34),inset_0.5px_-0.5px_8px_0px_rgba(185,232,255,0.22),0_0_18px_rgba(125,212,255,0.24),0_12px_28px_rgba(0,0,0,0.24)] transition-transform hover:scale-[0.99]"
					>
						Preview
					</button>
				{/if}
				<button
					type="button"
					onclick={change_from_image_actions}
					class="rounded-[1.25rem] bg-[linear-gradient(90deg,#7DD4FF30_0%,#AAAAAA20_50%,#CD82FF38_100%)] px-4 py-3.5 text-sm font-semibold text-[#CD82FF] shadow-[inset_1px_-1px_18px_0px_#CD82FF,inset_0.5px_-0.5px_8px_0px_#7DD4FF,0_0_18px_rgba(205,130,255,0.22),0_12px_28px_rgba(0,0,0,0.24)] transition-transform hover:scale-[0.99]"
				>
					Change photo
				</button>
				<button
					type="button"
					onclick={close_image_actions_menu}
					class="rounded-[1.25rem] border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/72 transition-colors hover:bg-white/12 hover:text-white"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if image_editor}
	<div
		class="fixed inset-0 z-70 flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(125,212,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(205,130,255,0.18),transparent_32%),rgba(4,3,13,0.9)] px-2 py-2 backdrop-blur-md md:px-6 md:py-6"
		role="dialog"
		aria-modal="true"
		aria-busy={is_applying_image_editor}
		aria-label={image_editor.mode === 'cover'
			? 'Edit cover image'
			: image_editor.mode === 'post'
				? 'Edit post image'
				: image_editor.mode === 'video-post'
					? 'Edit post video'
					: 'Edit profile image'}
		tabindex="0"
		bind:this={image_editor_backdrop}
		transition:fade={{ duration: 180 }}
		onclick={(event) => {
			if (event.target === event.currentTarget && !is_applying_image_editor) {
				close_image_editor();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape' && !is_applying_image_editor) {
				close_image_editor();
			}
		}}
	>
		<div
			class="editor-shell max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-y-auto rounded-[1.1rem] border border-white/12 md:max-h-[90vh] md:rounded-[1.75rem] {image_editor.mode ===
			'video-post'
				? 'editor-shell-video'
				: ''} {image_editor.natural_width < image_editor.natural_height
				? 'editor-shell-vertical-media'
				: ''}"
			inert={is_applying_image_editor}
			style={image_editor.mode === 'video-post'
				? `--editor-video-preview-column-width:${image_editor.natural_width >= image_editor.natural_height ? 'min(62vw, 720px)' : `min(48vw, ${image_editor_frame_ratio * 82}dvh)`};--editor-video-shell-width:${image_editor.natural_width >= image_editor.natural_height ? 'min(96vw, 1080px)' : 'min(96vw, 860px)'};`
				: undefined}
			transition:scale={{ duration: 220, start: 0.96, opacity: 0.55 }}
		>
			<div
				class="grid gap-0 lg:grid-cols-[minmax(260px,320px)_1fr] {image_editor.mode === 'video-post'
					? 'editor-layout-video'
					: ''}"
			>
				<div
					class="editor-controls-pane order-2 border-t border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-2.5 md:p-5 lg:order-1 lg:border-t-0 lg:border-r lg:p-6"
				>
					<div class="flex items-start justify-between gap-4">
						<div>
							<p
								class="hidden text-[11px] font-semibold tracking-[0.26em] text-sky-200/70 uppercase md:block"
							>
								Adjust
							</p>
							<h2 class="text-sm font-semibold text-white md:mt-1 md:text-2xl">
								{image_editor.mode === 'cover'
									? 'Cover'
									: image_editor.mode === 'post'
										? 'Post'
										: image_editor.mode === 'video-post'
											? 'Video'
											: 'Profile'}
							</h2>
						</div>
						<button
							type="button"
							onclick={() => {
								close_image_editor();
							}}
							class="editor-remove-action grid h-8 w-8 place-items-center rounded-full text-base transition-colors md:h-10 md:w-10 md:text-lg"
							disabled={is_applying_image_editor}
							aria-label="Close image editor"
						>
							×
						</button>
					</div>

					<div
						class="mt-2 rounded-2xl border border-white/8 bg-white/[0.035] p-2.5 md:mt-4 md:rounded-[1.35rem] md:p-4"
					>
						{#if image_editor.mode === 'video-post'}
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs font-medium text-white/84 md:text-sm">Trim</span>
								<span class="text-[11px] font-semibold tracking-[0.12em] text-sky-200/70 uppercase">
									{format_media_time(post_video_trim_end_seconds - post_video_trim_start_seconds)}
								</span>
							</div>

							<div class="mt-3 space-y-3">
								<div>
									<div class="mb-1 flex items-center justify-between text-[11px] text-white/68">
										<span>Start</span>
										<span>{format_media_time(post_video_trim_start_seconds)}</span>
									</div>
									<div class="flex items-center gap-2">
										<button
											type="button"
											onclick={() => adjust_video_trim_point('start', -1)}
											class="editor-zoom-step"
											aria-label="Trim video start back by 1 second"
											disabled={is_applying_image_editor}
										>
											-
										</button>
										<input
											type="range"
											min="0"
											max={Math.max(0, post_video_duration_seconds - 1)}
											step="any"
											value={post_video_trim_start_seconds}
											oninput={handle_video_trim_start_input}
											class="editor-slider w-full"
											aria-label="Trim video start"
											disabled={is_applying_image_editor}
										/>
										<button
											type="button"
											onclick={() => adjust_video_trim_point('start', 1)}
											class="editor-zoom-step"
											aria-label="Trim video start forward by 1 second"
											disabled={is_applying_image_editor}
										>
											+
										</button>
									</div>
								</div>
								<div>
									<div class="mb-1 flex items-center justify-between text-[11px] text-white/68">
										<span>End</span>
										<span>{format_media_time(post_video_trim_end_seconds)}</span>
									</div>
									<div class="flex items-center gap-2">
										<button
											type="button"
											onclick={() => adjust_video_trim_point('end', -1)}
											class="editor-zoom-step"
											aria-label="Trim video end back by 1 second"
											disabled={is_applying_image_editor}
										>
											-
										</button>
										<input
											type="range"
											min="1"
											max={Math.max(1, post_video_duration_seconds)}
											step="any"
											value={post_video_trim_end_seconds}
											oninput={handle_video_trim_end_input}
											class="editor-slider w-full"
											aria-label="Trim video end"
											disabled={is_applying_image_editor}
										/>
										<button
											type="button"
											onclick={() => adjust_video_trim_point('end', 1)}
											class="editor-zoom-step"
											aria-label="Trim video end forward by 1 second"
											disabled={is_applying_image_editor}
										>
											+
										</button>
									</div>
								</div>
							</div>

							<p class="mt-3 text-sm text-white/68">
								Original source size: {current_video_source_bytes <= 0
									? '0'
									: Math.max(
											0.1,
											Math.round((current_video_source_bytes / (1024 * 1024)) * 10) / 10
										)} MB
							</p>
							<p class="mt-1 text-sm text-white/68">
								Estimated trimmed output:
								<span
									class={`font-semibold ${is_estimated_trimmed_video_too_large ? 'text-rose-600' : 'text-emerald-300'}`}
								>
									{estimated_trimmed_video_size_label}
								</span>
								<span class="text-white/46">/ {video_upload_size_label} max</span>
							</p>
							{#if is_estimated_trimmed_video_too_large}
								<p class="mt-2 text-sm text-amber-200">
									Trim more to get the estimated clip size down to {video_upload_size_label} or less before
									posting.
								</p>
							{/if}
						{:else}
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs font-medium text-white/84 md:text-sm">Zoom</span>
								<button
									type="button"
									onclick={reset_image_editor_view}
									class="editor-reset-action rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors md:px-3 md:text-[11px] md:tracking-[0.18em]"
									disabled={is_applying_image_editor}
								>
									Reset
								</button>
							</div>

							<div class="mt-2 flex items-center gap-2 md:mt-4">
								<button
									type="button"
									onpointerdown={() => start_image_editor_zoom_step(-1)}
									onpointerup={stop_image_editor_zoom_step}
									onpointercancel={stop_image_editor_zoom_step}
									onpointerleave={stop_image_editor_zoom_step}
									onblur={stop_image_editor_zoom_step}
									class="editor-zoom-step"
									aria-label="Zoom out"
									disabled={is_applying_image_editor}
								>
									-
								</button>
								<input
									type="range"
									min="1"
									max="3"
									step="0.01"
									value={image_editor_zoom}
									oninput={(event) => {
										const next_value = Number((event.currentTarget as HTMLInputElement).value);
										update_image_editor_zoom(next_value);
									}}
									class="editor-slider w-full"
									aria-label="Zoom image"
									disabled={is_applying_image_editor}
								/>
								<button
									type="button"
									onpointerdown={() => start_image_editor_zoom_step(1)}
									onpointerup={stop_image_editor_zoom_step}
									onpointercancel={stop_image_editor_zoom_step}
									onpointerleave={stop_image_editor_zoom_step}
									onblur={stop_image_editor_zoom_step}
									class="editor-zoom-step"
									aria-label="Zoom in"
									disabled={is_applying_image_editor}
								>
									+
								</button>
							</div>

							<div
								class="mt-2 hidden items-center justify-between text-[11px] font-medium tracking-[0.16em] text-white/42 uppercase md:flex"
							>
								<span>Wide</span>
								<span>Close</span>
							</div>
						{/if}
					</div>

					{#if image_editor_error}
						<p
							class="mt-4 rounded-[1.2rem] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
						>
							{image_editor_error}
						</p>
					{/if}

					<div class="mt-2 grid grid-cols-2 gap-2 md:mt-3 md:gap-3 lg:mt-6 lg:grid-cols-1">
						<button
							type="button"
							onclick={() => {
								close_image_editor();
							}}
							class="editor-action-secondary rounded-[0.9rem] px-4 py-2 text-xs font-semibold text-white/82 transition-colors disabled:cursor-not-allowed disabled:opacity-55 md:rounded-[1.15rem] md:py-3 md:text-sm"
							disabled={is_applying_image_editor}
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={apply_image_editor}
							class="editor-action-primary rounded-[0.9rem] px-4 py-2 text-xs font-semibold text-[#CD82FF] transition-transform hover:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 md:rounded-[1.15rem] md:py-3 md:text-sm"
							disabled={is_applying_image_editor}
						>
							{is_applying_image_editor ? 'Applying...' : 'Save'}
						</button>
					</div>
				</div>

				<div
					class="editor-preview-pane order-1 flex min-h-0 items-center justify-center lg:order-2"
				>
					<div class="mx-auto flex w-full max-w-4xl items-center justify-center">
						{#if image_editor.mode === 'cover'}
							<div
								bind:this={image_editor_stage}
								class="editor-stage relative mx-auto aspect-16/6 w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 md:rounded-[1.45rem]"
								role="presentation"
								style="touch-action:none;"
								onpointerdown={begin_image_editor_drag}
								onpointermove={move_image_editor_drag}
								onpointerup={end_image_editor_drag}
								onpointercancel={end_image_editor_drag}
							>
								<img
									src={image_editor.src}
									alt="Selected cover preview"
									class="absolute top-1/2 left-1/2 max-w-none object-cover select-none"
									style={`width:${image_editor.natural_width * (get_image_editor_scale() ?? 1)}px;height:${image_editor.natural_height * (get_image_editor_scale() ?? 1)}px;transform:translate(calc(-50% + ${image_editor_offset_x}px), calc(-50% + ${image_editor_offset_y}px));`}
									draggable="false"
								/>
								{#if image_editor_drag_hint_visible}
									<div
										class="editor-drag-hint pointer-events-none absolute inset-0 grid place-items-center"
									>
										<span aria-hidden="true">Drag</span>
									</div>
								{/if}
								<div
									class="editor-stage-frame pointer-events-none absolute inset-0 border-6 md:border-12"
								></div>
							</div>
						{:else if image_editor.mode === 'post'}
							<div class="flex min-h-0 w-full items-center justify-center md:min-h-115">
								<div
									bind:this={image_editor_stage}
									class="editor-stage editor-post-stage relative w-full overflow-hidden rounded-2xl border border-white/10 md:rounded-[1.75rem]"
									role="presentation"
									style={`touch-action:none;aspect-ratio:${image_editor_frame_ratio};--post-editor-mobile-max-width:${image_editor_frame_ratio * 34}dvh;--post-editor-max-width:${image_editor.natural_width >= image_editor.natural_height ? '640px' : `min(100%, ${image_editor_frame_ratio * 82}dvh)`};`}
									onpointerdown={begin_image_editor_drag}
									onpointermove={move_image_editor_drag}
									onpointerup={end_image_editor_drag}
									onpointercancel={end_image_editor_drag}
								>
									<img
										src={image_editor.src}
										alt="Selected post preview"
										class="absolute top-1/2 left-1/2 max-w-none object-cover select-none"
										style={`width:${image_editor.natural_width * (get_image_editor_scale() ?? 1)}px;height:${image_editor.natural_height * (get_image_editor_scale() ?? 1)}px;transform:translate(calc(-50% + ${image_editor_offset_x}px), calc(-50% + ${image_editor_offset_y}px));`}
										draggable="false"
									/>
									{#if image_editor_drag_hint_visible}
										<div
											class="editor-drag-hint pointer-events-none absolute inset-0 grid place-items-center"
										>
											<span aria-hidden="true">Drag</span>
										</div>
									{/if}
									<div
										class="editor-stage-frame pointer-events-none absolute inset-0 rounded-2xl border-6 md:rounded-[1.75rem] md:border-12"
									></div>
								</div>
							</div>
						{:else if image_editor.mode === 'video-post'}
							<div
								class="editor-video-preview-wrap flex min-h-0 w-full items-center justify-center"
							>
								<div
									class="editor-stage editor-post-stage editor-video-stage relative w-full overflow-hidden rounded-2xl border border-white/10 md:rounded-[1.75rem]"
									role="presentation"
									style={`aspect-ratio:${image_editor_frame_ratio};--post-editor-mobile-max-width:${image_editor_frame_ratio * 22}dvh;--post-editor-max-width:${image_editor.natural_width >= image_editor.natural_height ? '100%' : `min(100%, ${image_editor_frame_ratio * 82}dvh)`};--post-editor-video-max-width:${image_editor.natural_width >= image_editor.natural_height ? '100%' : `min(100%, ${image_editor_frame_ratio * 82}dvh)`};--post-editor-video-max-height:${image_editor.natural_width >= image_editor.natural_height ? 'min(32dvh, calc(100dvh - 21rem))' : '82dvh'};`}
								>
									<!-- svelte-ignore a11y_media_has_caption -->
									<video
										bind:this={video_editor_preview_element}
										src={image_editor.src}
										controls
										playsinline
										preload="metadata"
										onloadedmetadata={() => {
											sync_video_trim_preview(video_trim_preview_focus);
										}}
										class="h-full w-full object-contain"
									></video>
								</div>
							</div>
						{:else}
							<div class="flex min-h-0 w-full items-center justify-center md:min-h-105">
								<div
									bind:this={image_editor_stage}
									class="editor-stage relative aspect-square w-full max-w-42 overflow-hidden rounded-full border border-white/10 min-[390px]:max-w-46 min-[480px]:max-w-52 md:max-w-105"
									role="presentation"
									style="touch-action:none;"
									onpointerdown={begin_image_editor_drag}
									onpointermove={move_image_editor_drag}
									onpointerup={end_image_editor_drag}
									onpointercancel={end_image_editor_drag}
								>
									<img
										src={image_editor.src}
										alt="Selected profile preview"
										class="absolute top-1/2 left-1/2 max-w-none object-cover select-none"
										style={`width:${image_editor.natural_width * (get_image_editor_scale() ?? 1)}px;height:${image_editor.natural_height * (get_image_editor_scale() ?? 1)}px;transform:translate(calc(-50% + ${image_editor_offset_x}px), calc(-50% + ${image_editor_offset_y}px));`}
										draggable="false"
									/>
									{#if image_editor_drag_hint_visible}
										<div
											class="editor-drag-hint pointer-events-none absolute inset-0 grid place-items-center rounded-full"
										>
											<span aria-hidden="true">Drag</span>
										</div>
									{/if}
									<div
										class="editor-stage-frame pointer-events-none absolute inset-0 rounded-full border-6 md:border-12"
									></div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
		{#if is_applying_image_editor}
			<div
				class="absolute inset-0 z-80 grid cursor-wait place-items-center bg-black/38 backdrop-blur-[2px]"
				aria-live="polite"
			>
				<div
					class="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,7,24,0.86)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.38)]"
				>
					<span class="editor-processing-spinner" aria-hidden="true"></span>
					<span>{image_editor.mode === 'video-post' ? 'Applying trim...' : 'Saving...'}</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

{#if is_saving_profile_media}
	<div
		class="fixed inset-0 z-90 grid cursor-wait place-items-center bg-black/45 backdrop-blur-[2px]"
		role="status"
		aria-live="polite"
	>
		<div
			class="flex items-center gap-3 rounded-full border border-white/12 bg-[rgba(8,7,24,0.9)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(0,0,0,0.38)]"
		>
			<span class="editor-processing-spinner" aria-hidden="true"></span>
			<span>Updating...</span>
		</div>
	</div>
{/if}

{#if image_preview}
	<div
		class="fixed inset-0 z-60 flex cursor-zoom-out items-center justify-center bg-black/90 px-4 py-6 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
		aria-label="Image preview"
		tabindex="0"
		bind:this={image_preview_backdrop}
		onclick={close_image_preview}
		transition:fade={{ duration: 180 }}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				close_image_preview();
			}
		}}
	>
		<img
			src={image_preview.src}
			alt={image_preview.alt}
			class="max-h-[92vh] max-w-[96vw] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.55)] {image_preview.is_avatar
				? 'rounded-full'
				: 'rounded-3xl'}"
			decoding="async"
			transition:scale={{ duration: 220, start: 0.92, opacity: 0.55 }}
		/>
	</div>
{/if}
