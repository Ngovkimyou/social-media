<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	const { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<div class="mx-auto flex flex-col items-center justify-center px-6 py-8 md:h-screen lg:py-0">
	<form method="post" action="?/signInEmail" use:enhance>
		<div>
			<label>
				Email
				<input
					type="email"
					name="email"
					class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</label>
		</div>
		<div>
			<label>
				Password
				<input
					type="password"
					name="password"
					class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</label>
		</div>
		<div>
			<label>
				Name (for registration)
				<input
					name="name"
					class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</label>
		</div>
		<button
			formaction="?/signUpEmail"
			class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
			>Register</button
		>
	</form>
</div>
<p class="text-red-500">{form?.message ?? ''}</p>
