<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const active_path = $derived(page.url.pathname);
	const home_href = resolve('/home');
	const search_href = resolve('/search');
	const profile_href = resolve('/profile');
	const ison_home = $derived(active_path === home_href);
	const ison_search = $derived(active_path === search_href);
	const ison_profile = $derived(active_path.startsWith('/profile'));
	const glow_base =
		"before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle,rgba(210,150,255,0.95)_0%,rgba(146,95,255,0.55)_65%,rgba(146,95,255,0.2)_100%)] before:shadow-[0_0_24px_rgba(180,120,255,0.7)] before:transition-all before:duration-300 before:ease-out";
	const glow_off = 'before:opacity-0 before:scale-90';
	const glow_on = 'before:opacity-100 before:scale-100';
	const nav_link_base =
		'relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition-[background,box-shadow,backdrop-filter,transform] duration-300 ease-out hover:bg-white/6';
	const active_link =
		'!text-[#7DD4FF] bg-[linear-gradient(90deg,#AAAAAA30_0%,#77777730_50%,#7AA5BB30_75%,#7DD4FF30_100%)] shadow-[inset_1px_-1px_30px_0px_#CD82FF,inset_0.5px_-0.5px_10px_0px_#CD82FF] backdrop-blur-[5px]';
</script>

<!-- Top Tab (scrolls naturally) -->
<div class="flex h-18 w-full items-center justify-between bg-[#09051C] px-6 md:hidden">
	<a href={home_href} class="cursor-pointer transition-opacity hover:opacity-80">
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

<!-- Bottom Tab (fixed) -->
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

		<a
			href={profile_href}
			class={`relative grid h-14 w-14 cursor-pointer place-items-center transition-opacity duration-200 ${glow_base} ${ison_profile ? glow_on : `${glow_off} hover:opacity-80`}`}
			aria-label="Profile"
		>
			<img src="/images/go-to-profile.png" alt="Profile icon" class="h-8 opacity-80" />
		</a>
	</div>
</nav>

<!-- Desktop Sidebar -->
<aside
	class="fixed top-0 left-0 hidden h-screen w-72 flex-col gap-15 bg-[#09051C] p-6 text-white md:flex"
>
	<a href={home_href} class="block w-fit self-center transition-opacity hover:opacity-80">
		<img src="/images/Space-and-Time-logo.png" alt="Space and Time Logo" class="h-16" />
	</a>

	<button
		type="button"
		class="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-lg font-semibold text-white/90 transition-colors hover:bg-white/6"
	>
		<img src="/images/expand-tab.png" alt="Close Tab icon" class="h-6 w-6" />
		<span>Close Tab</span>
	</button>

	<nav class="space-y-2">
		<a href={home_href} class={`${nav_link_base} ${ison_home ? active_link : ''}`}>
			<img src="/images/home-page-icon.png" alt="Home Page icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Home</span>
		</a>

		<a href={search_href} class={`${nav_link_base} ${ison_search ? active_link : ''}`}>
			<img src="/images/search.png" alt="Search icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Search</span>
		</a>

		<a href={profile_href} class={`${nav_link_base} ${ison_profile ? active_link : ''}`}>
			<img src="/images/go-to-profile.png" alt="Profile icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Profile</span>
		</a>

		<button type="button" class={nav_link_base}>
			<img src="/images/open-messages.png" alt="Messages icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Message</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img src="/images/setting.png" alt="Settings icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Setting</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img src="/images/change-theme-icon.png" alt="Change Theme icon" class="h-6 w-6" />
			<span class="text-lg font-semibold">Theme</span>
		</button>

		<button type="button" class={nav_link_base}>
			<img
				src="/images/about-this-account-icon.png"
				alt="About this Account icon"
				class="h-6 w-6"
			/>
			<span class="text-lg font-semibold">About</span>
		</button>
	</nav>

	<div class="mt-auto px-2 pb-2">
		<button
			type="button"
			class="rounded-xl p-2 transition-colors duration-200 hover:bg-white/6"
			aria-label="Toggle theme"
		>
			<img src="/images/dark-mode.png" alt="Toggle light/dark mode icon" class="h-7 w-7" />
		</button>
	</div>
</aside>
