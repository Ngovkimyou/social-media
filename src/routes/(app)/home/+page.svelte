<section class="space-y-4 p-4">
	<h1 class="text-2xl font-bold">Home</h1>
	<p class="text-sm text-gray-600">Scroll down to test the top and bottom tabs behavior.</p>

	{#each Array.from({ length: 20 }, (_unused, item_index) => item_index + 1) as post_number (post_number)}
		<article class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="text-base font-semibold">Post #{post_number}</h2>
			<p class="mt-2 text-sm leading-6 text-gray-700">
				This is mock content for scrolling test. Keep scrolling to verify the bottom tab stays fixed
				and the top tab follows normal page flow.
			</p>
		</article>
	{/each}
</section>
