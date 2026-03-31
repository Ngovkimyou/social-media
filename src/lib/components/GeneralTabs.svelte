<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const active_path = $derived(page.url.pathname);
	const home_href = resolve('/home');
	const search_href = resolve('/search');
	const ison_home = $derived(active_path === home_href);
	const ison_search = $derived(active_path === search_href);
	const glow_base =
		"before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle,rgba(210,150,255,0.95)_0%,rgba(146,95,255,0.55)_65%,rgba(146,95,255,0.2)_100%)] before:shadow-[0_0_24px_rgba(180,120,255,0.7)] before:transition-all before:duration-300 before:ease-out";
	const glow_off = 'before:opacity-0 before:scale-90';
	const glow_on = 'before:opacity-100 before:scale-100';
</script>

<!-- top tab (scrolls naturally) -->
<div class="flex h-18 w-full items-center justify-between bg-[#09051C] px-6 md:hidden">
	<a href={resolve('/home')} class="cursor-pointer transition-opacity hover:opacity-80">
		<img src="/images/Space-and-Time-logo.png" alt="Space and Time Logo" class="h-12" />
	</a>
	<div class="flex items-center gap-6">
		<img
			src="/images/dark-mode.png"
			alt="dark/light mode switch icon"
			class="h-8 transition-opacity hover:opacity-80"
		/>
		<img
			src="/images/more-setting.png"
			alt="More Settings"
			class="h-8 transition-opacity hover:opacity-80"
		/>
	</div>
</div>

<!-- bottom tab (fixed) -->
<nav
	class="fixed right-0 bottom-0 left-0 z-50 flex h-18 w-full items-center justify-center bg-[#09051C] md:hidden"
>
	<div class="flex w-full items-center justify-around">
		<button class="relative grid h-14 w-14 place-items-center" type="button" aria-label="Settings">
			<img src="/images/setting.png" alt="Settings" class="h-8 opacity-80" />
		</button>

		<a
			href={search_href}
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_search ? glow_on : `${glow_off} hover:opacity-80`}`}
		>
			<img src="/images/search.png" alt="Search" class="relative z-10 h-8" />
		</a>

		<a
			href={home_href}
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_home ? glow_on : `${glow_off} hover:opacity-80`}`}
		>
			<img src="/images/home-page-icon.png" alt="Home Screen" class="relative z-10 h-8" />
		</a>

		<button
			class="relative grid h-14 w-14 place-items-center"
			type="button"
			aria-label="Send Messages"
		>
			<img src="/images/open-messages.png" alt="Send Messages icon" class="h-8 opacity-80" />
		</button>

		<button class="relative grid h-14 w-14 place-items-center" type="button" aria-label="Profile">
			<img src="/images/go-to-profile.png" alt="Profile icon" class="h-8 opacity-80" />
		</button>
	</div>
</nav>
