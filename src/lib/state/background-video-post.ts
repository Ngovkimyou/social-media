import { writable } from 'svelte/store';

export type BackgroundVideoPostStatus = 'uploading' | 'saving' | 'complete' | 'error';

export type BackgroundVideoPostState = {
	cancel: () => void;
	dismiss: () => void;
	error_message?: string;
	file_name: string;
	keep_uploading: () => void;
	confirm_cancel: () => void;
	is_cancel_confirming: boolean;
	media_type?: 'image' | 'video';
	progress_percent: number;
	status: BackgroundVideoPostStatus;
};

export const background_video_post = writable<BackgroundVideoPostState | undefined>();
