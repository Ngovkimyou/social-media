<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	const { form }: { form: ActionData } = $props();
</script>

<div class="body">
	<div class="login-container">
		<div class="form-container">
			<h1 class="login-title">Login</h1>
			<form method="post" action="?/signInEmail" use:enhance>
				<div>
					<label class="login-label">
						Email
						<input
							type="email"
							name="email"
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your email address"
						/>
					</label>
				</div>
				<div>
					<label class="login-label">
						Password
						<input
							type="password"
							name="password"
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your password"
						/>
					</label>
				</div>
				<button formaction="?/signInEmail" class="login-button">Login</button>
				<a
					href="/Sign-up"
					class="login-button"
					style="background-color: #10b981; margin-left: 1cqw;">Sign Up</a
				>
			</form>
			<p class="login-message">
				{form?.message ?? ''}
			</p>
		</div>
		<img src="/assets/Manga Wallpaper.gif" alt="Login Illustration" class="login-img" />
	</div>
</div>

<style>
	.login-container {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		max-width: 75vw;
		width: 70vw;
		max-height: 85vh;
		aspect-ratio: 16/10;
		margin: 0 auto;
		padding: 0;
		background-color: #ffffff;
		border-radius: 2cqw;
		container-type: inline-size;
		box-shadow: 0 2cqw 4cqw rgba(0, 0, 0, 0.2);
	}
	.form-container {
		display: flex;
		flex-direction: column;
		max-height: 100%;
		height: 100%;
		min-width: 0;
		padding: 1cqw 3cqw 1cqw 5cqw;
		justify-content: center;
	}

	.form-container,
	.login-img {
		min-width: 0;
		min-height: 0;
	}
	.body {
		display: flex;
		justify-content: center;
		align-items: center;
		background: linear-gradient(135deg, #cd82ff, #7dd4ff);
		height: 100vh;
		width: 100vw;
	}
	.login-title {
		font-size: 5cqw; /* Text grows with the box */
		font-weight: bold;
		margin-bottom: 2cqw;
	}

	.login-label {
		font-size: 2.5cqw;
		margin-top: 1.5cqw;
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.login-input {
		font-size: 2.5cqw;
		padding: 1cqw 1.5cqw;
		border: 0.2cqw solid #d1d5db;
		border-radius: 0.5cqw;
		margin-top: 0.5cqw;
	}

	.login-button {
		margin-top: 2cqw;
		background: linear-gradient(135deg, #cd82ff, #7dd4ff);
		color: white;
		padding: 1cqw 2cqw;
		font-size: 2cqw;
		border-radius: 0.5cqw;
	}

	.login-message {
		color: red;
		margin-top: 1cqw;
		font-size: 2cqw;
	}

	.login-img {
		width: 100%;
		height: 100%;
		border-radius: 0cqw 2cqw 2cqw 0cqw;
		object-fit: cover;
	}
</style>
