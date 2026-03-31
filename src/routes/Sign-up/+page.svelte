<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	const { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<div class="login-container">
	<div>
		<form method="post" action="?/signInEmail" use:enhance>
			<div class="mt-1">
				<label>
					Email
					<input
						type="email"
						name="email"
						class="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</label>
			</div>
			<div class="mt-1">
				<label>
					Password
					<input
						type="password"
						name="password"
						class="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</label>
			</div>
			<div class="mt-1">
				<label>
					Name (for registration)
					<input
						name="name"
						class="rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</label>
			</div>
			<button
				formaction="?/signUpEmail"
				class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
				>Register</button
			>
		</form>
	</div>
	<img
		src="/assets/Pixel Art.gif"
		alt="Login Illustration"
		class="h-full w-full max-w-md shadow-md"
	/>
</div>
<p class="text-red-500">{form?.message ?? ''}</p>

<style>
	.login-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		max-width: 400px;
		margin: 0 auto;
		padding: 0;
		background-color: #ffffff;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}
</style>
