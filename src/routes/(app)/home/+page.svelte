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
	<div class="glow-card aspect-square rounded-4xl"></div>
	<div class="glow-card aspect-square rounded-4xl"></div>
	<div class="glow-card aspect-square rounded-4xl"></div>
	<div class="glow-card aspect-square rounded-4xl"></div>
	<div class="glow-card aspect-square rounded-4xl"></div>
	<div class="glow-card aspect-square rounded-4xl"></div>
</div>

<style>
	.glow-card {
		background: rgba(17, 13, 38, 0.4);
		backdrop-filter: blur(8px);
		border: 2px solid rgba(210, 148, 255, 0.3);
		box-shadow: 0 0 20px rgba(210, 148, 255, 0.15);
		transition: all 0.3s ease;
	}

	.glow-card:hover {
		box-shadow: 0 0 30px rgba(210, 148, 255, 0.3);
		border-color: rgba(210, 148, 255, 0.5);
	}
</style>
