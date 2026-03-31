<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<!-- SideNavBar Component -->
<aside class="fixed top-0 left-0 z-50 flex h-screen w-72 flex-col bg-background px-8 py-10">
	<div class="mb-14">
		<a href={resolve('/')}><h1 class="text-5xl font-bold tracking-tight text-white">Logo</h1></a>
	</div>
	<nav class="flex flex-1 flex-col gap-4">
		<a
			class="flex items-center gap-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
			href={resolve('/')}
		>
			<span class="material-symbols-outlined text-3xl">send</span>
			<span class="text-lg font-bold">Expand Tab</span>
		</a>
		<div class="mt-4 flex flex-col gap-2">
			<a
				class="active-tab flex items-center gap-4 px-4 py-3 text-white transition-all duration-300"
				href={resolve('/')}
			>
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
					<span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1"
						>home</span
					>
				</div>
				<span class="text-lg font-bold">Home</span>
			</a>
			<a
				class="flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				//href={resolve('/search')}
				href="#search"
			>
				<span class="material-symbols-outlined text-3xl">search</span>
				<span class="text-lg font-bold">Search</span>
			</a>
			<a
				class="flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				href="#profile"
			>
				<span class="material-symbols-outlined text-3xl">person</span>
				<span class="text-lg font-bold">Profile</span>
			</a>
			<a
				class="relative flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				href="#messages"
			>
				<span class="material-symbols-outlined text-3xl">send</span>
				<span class="flex-1 text-lg font-bold">Message</span>
				<div
					class="absolute top-3 left-6 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-blue-400"
				>
					<span class="text-[10px] font-bold text-white">5</span>
				</div>
			</a>
			<a
				class="flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				href="#settings"
			>
				<span class="material-symbols-outlined text-3xl">settings</span>
				<span class="text-lg font-bold">Setting</span>
			</a>
			<a
				class="flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				href="#theme"
			>
				<span class="material-symbols-outlined text-3xl">palette</span>
				<span class="text-lg font-bold">Theme</span>
			</a>
			<a
				class="flex items-center gap-4 px-4 py-3 text-on-surface transition-all duration-300 hover:text-white"
				href="#about"
			>
				<span class="material-symbols-outlined text-3xl">info</span>
				<span class="text-lg font-bold">About</span>
			</a>
		</div>
	</nav>
	<div class="mt-auto">
		<span
			class="material-symbols-outlined cursor-pointer text-4xl text-on-surface-variant transition-colors hover:text-white"
			style="font-variation-settings: 'FILL' 1">dark_mode</span
		>
	</div>
</aside>

<!-- Main Canvas Area -->
<main class="ml-72 min-h-screen flex-1 p-12">
	<div class="min-h-[calc(100vh-6rem)] rounded-[3rem] bg-surface-container/50 p-12">
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
			<div class="glow-card aspect-square rounded-[2rem]"></div>
			<div class="glow-card aspect-square rounded-[2rem]"></div>
			<div class="glow-card aspect-square rounded-[2rem]"></div>
			<div class="glow-card aspect-square rounded-[2rem]"></div>
			<div class="glow-card aspect-square rounded-[2rem]"></div>
			<div class="glow-card aspect-square rounded-[2rem]"></div>
		</div>
	</div>
</main>

<style>
	.active-tab {
		background: linear-gradient(90deg, rgba(210, 148, 255, 0.2) 0%, rgba(210, 148, 255, 0.05) 100%);
		border-radius: 0.75rem;
		position: relative;
		box-shadow: 0 0 15px rgba(210, 148, 255, 0.3);
	}

	.active-tab::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 4px;
		background: #d294ff;
		border-radius: 0 2px 2px 0;
	}

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
