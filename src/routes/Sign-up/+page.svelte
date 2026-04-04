<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	const { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<link rel="preload" as="image" href="/assets/Pixel Art.gif" media="(min-width: 900px)" />
</svelte:head>

<div class="body">
	<div class="login-container">
		<div class="form-container">
			<h1 class="login-title">Sign Up</h1>
			<form method="post" action="?/signUpEmail" use:enhance>
				<div class="input-group">
					<label class="login-label">
						Email
						<input
							type="email"
							name="email"
							required
							maxlength="254"
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your email address"
						/>
					</label>
				</div>
				<div class="input-group">
					<label class="login-label">
						Password
						<input
							type="password"
							name="password"
							minlength="8"
							maxlength="128"
							required
							pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*"
							title="Password must be 8 to 128 characters and include uppercase, lowercase, and a number."
							aria-describedby="password-requirements"
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your password"
						/>
						<span id="password-requirements" class="sr-only">
							Password must be 8 to 128 characters and include uppercase, lowercase, and a number.
						</span>
					</label>
				</div>
				<div class="input-group">
					<label class="login-label">
						Name
						<input
							type="text"
							name="name"
							minlength="3"
							maxlength="15"
							required
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your username"
						/>
					</label>
				</div>
				<div class="login-actions">
					<button formaction="?/signUpEmail" class="login-button">Register</button>
					<a href={resolve('/login')} class="login-button login-signup-link">Back to Login</a>
				</div>
			</form>
			<p class="login-message" aria-live="polite">
				{form?.message ?? ''}
			</p>
		</div>
		<img
			src="/assets/Pixel Art.gif"
			alt="Login Illustration"
			class="login-img"
			loading="eager"
			decoding="async"
			fetchpriority="high"
		/>
	</div>
</div>

<style>
	.login-container {
		display: grid;
		grid-template-columns: 1fr;
		width: min(100%, 60rem);
		margin: 0 auto;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(14px) saturate(120%);
		-webkit-backdrop-filter: blur(14px) saturate(120%);
		border-radius: 1.5rem;
		box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.2);
	}

	@media (min-width: 900px) {
		.login-container {
			grid-template-columns: minmax(18rem, 24rem) 1fr;
			min-height: clamp(30rem, 72dvh, 40rem);
		}
	}

	.form-container {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 3rem);
		justify-content: center;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.1));
		backdrop-filter: blur(24px) saturate(120%);
		-webkit-backdrop-filter: blur(24px) saturate(120%);
		border: 1px solid rgba(255, 255, 255, 0.25);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
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
		min-height: 100dvh;
		width: 100%;
		padding: 1rem;
	}
	.login-title {
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		font-weight: 800;
		margin-bottom: 1.25rem;
		letter-spacing: 0.03em;
		background: linear-gradient(90deg, #c062ff 0%, #0318f8 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.login-label {
		font-size: clamp(0.95rem, 2.4vw, 1.1rem);
		display: flex;
		flex-direction: column;
		width: 100%;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #2b2d57;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
	}

	.input-group + .input-group {
		margin-top: 1rem;
	}

	.login-input {
		font-size: clamp(0.95rem, 2.4vw, 1rem);
		padding: 0.7rem 0.9rem;
		border: 1px solid #d1d5db;
		border-radius: 0.6rem;
		margin-top: 0.45rem;
	}

	.login-button {
		background: linear-gradient(90deg, #cd82ff 0%, #7dd4ff 100%);
		color: white;
		padding: 0.7rem 1rem;
		font-size: clamp(0.95rem, 2.2vw, 1rem);
		border-radius: 0.6rem;
		text-align: center;
		line-height: 1.25;
		transition:
			transform 180ms ease,
			box-shadow 180ms ease,
			filter 180ms ease;
		box-shadow: 0 8px 18px rgba(43, 45, 87, 0.18);
		will-change: transform, box-shadow, filter;
	}

	.login-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 22px rgba(43, 45, 87, 0.24);
		filter: brightness(1.03);
	}

	.login-button:active {
		transform: translateY(1px) scale(0.985);
		box-shadow: 0 5px 12px rgba(43, 45, 87, 0.18);
		filter: brightness(0.96);
	}

	.login-button:focus-visible {
		outline: 2px solid rgba(43, 45, 87, 0.7);
		outline-offset: 2px;
	}

	.login-actions {
		display: grid;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	@media (min-width: 520px) {
		.login-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.login-signup-link {
		background: #10b981;
	}

	.login-message {
		color: red;
		margin-top: 0.9rem;
		font-size: clamp(0.9rem, 2vw, 1rem);
		min-height: 1.35rem;
	}

	.login-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: none;
	}

	@media (min-width: 900px) {
		.login-img {
			display: block;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.login-button {
			transition: none;
			will-change: auto;
		}
	}
</style>
