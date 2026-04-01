<script lang="ts">
	import './home.css';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<div class="px-4 pt-5 md:px-0 md:pt-0">
	<!-- Header Section -->
	<div class="mb-12 flex items-center justify-between">
		<h2 class="text-6xl font-bold text-white">Feed</h2>
		<button class="p-2 text-white/70 transition-colors hover:text-white">
			<span class="material-symbols-outlined text-4xl" style="font-variation-settings: 'FILL' 1"
				>grid_view</span
			>
		</button>
	</div>

	<!-- Bento Grid Feed Content -->
	<div class="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
		{#each data.posts as post (post.id)}
			<div
				class="aspect-square rounded-4xl bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px] transition-all duration-300 ease-in-out hover:shadow-[inset_1px_-1px_50px_0px_#CD82FF,inset_0.5px_-0.5px_20px_0px_#CD82FF]"
			>
				<!-- post content goes here: post.author, post.imageUrl, post.caption, etc. -->
			</div>
		{/each}
	</div>
</div>
