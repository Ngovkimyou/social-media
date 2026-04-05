import { derived, writable } from 'svelte/store';

const DESKTOP_SIDEBAR_EXPANDED_WIDTH = '18rem';
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = '6rem';

export const is_desktop_sidebar_collapsed = writable(false);

export const desktop_sidebar_width = derived(is_desktop_sidebar_collapsed, ($is_collapsed) =>
	$is_collapsed ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH : DESKTOP_SIDEBAR_EXPANDED_WIDTH
);

export function toggle_desktop_sidebar(): void {
	is_desktop_sidebar_collapsed.update((is_collapsed) => !is_collapsed);
}
