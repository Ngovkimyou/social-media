<script lang="ts">
	import PostFeedView from '$lib/components/PostFeedView.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	const back_path = $derived(
		`/profile/${encodeURIComponent(data.profile.username)}` as `/profile/${string}`
	);
	const get_post_path = (post: PageData['posts'][number]): `/profile/${string}/shared/${string}` =>
		`/profile/${encodeURIComponent(data.profile.username)}/shared/${String(post.id)}`;
</script>

<PostFeedView
	posts={data.posts}
	title={data.profile.name ?? data.profile.username}
	{back_path}
	{get_post_path}
/>
