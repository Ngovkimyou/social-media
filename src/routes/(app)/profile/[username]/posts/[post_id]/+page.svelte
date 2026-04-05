<script lang="ts">
	import { resolve } from '$app/paths';
	import PostFeedView from '$lib/components/PostFeedView.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<PostFeedView
	posts={data.posts}
	title={data.profile.name ?? data.profile.username}
	back_href={resolve(`/profile/${encodeURIComponent(data.profile.username)}`)}
	get_post_href={(post) =>
		resolve(`/profile/${encodeURIComponent(data.profile.username)}/posts/${post.id}`)}
/>
