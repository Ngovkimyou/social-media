<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		get_email_validation_message,
		get_password_validation_message
	} from '$lib/utilities/auth-form-validation';
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';

	const { data, form }: { data: PageData; form: ActionData } = $props();
	let is_password_visible = $state(false);
	let turnstile_container = $state<HTMLDivElement | undefined>();
	let turnstile_widget_id = $state<string | undefined>();
	let turnstile_token = $state('');
	let turnstile_scale = $state(1);
	let turnstile_height = $state(70);
	let turnstile_mount_key = $state(0);
	let is_submitting = $state(false);

	type TurnstileWindow = Window & {
		turnstile?: {
			remove: (widget_id: string) => void;
			render: (
				container: HTMLElement,
				options: {
					callback: (token: string) => void;
					sitekey: string;
					size?: 'flexible';
					theme?: 'auto';
				}
			) => string;
		};
	};

	const turnstile_required = $derived(
		form && 'turnstile_required' in form
			? form.turnstile_required === true
			: data.turnstile_required === true
	);
	const turnstile_site_key = $derived(
		form && 'turnstile_site_key' in form
			? (form.turnstile_site_key ?? '')
			: (data.turnstile_site_key ?? '')
	);
	const submitted_email = $derived(form && 'email' in form ? (form.email ?? '') : '');
	const form_message = $derived(form && 'message' in form ? (form.message ?? '') : '');

	const apply_email_validation = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_email_validation_message(input.value));
	};

	const apply_password_validation = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_password_validation_message(input.value));
	};

	const handle_submit: SubmitFunction = () => {
		is_submitting = true;

		return async ({ update }) => {
			try {
				await update();
			} finally {
				is_submitting = false;
			}
		};
	};

	const mount_turnstile_widget = (): void => {
		const turnstile_api = (window as TurnstileWindow).turnstile;
		const site_key = String(turnstile_site_key ?? '');
		if (!turnstile_required || !site_key || !turnstile_container || !turnstile_api) {
			return;
		}

		if (turnstile_widget_id) {
			return;
		}

		turnstile_token = '';
		try {
			turnstile_widget_id = turnstile_api.render(turnstile_container, {
				callback: (token) => {
					turnstile_token = token;
				},
				size: 'flexible',
				sitekey: site_key,
				theme: 'auto'
			});
		} catch {
			turnstile_widget_id = undefined;
		}
	};

	const sync_turnstile_layout = (): void => {
		if (!turnstile_container) {
			turnstile_scale = 1;
			turnstile_height = 70;
			return;
		}

		const container_width = turnstile_container.clientWidth;
		const widget_width = 300;
		const widget_height = 65;
		const next_scale = container_width > 0 ? Math.min(1, container_width / widget_width) : 1;

		turnstile_scale = next_scale;
		turnstile_height = Math.max(52, Math.ceil(widget_height * next_scale));
	};

	onMount(() => {
		const resize_observer = new ResizeObserver(() => {
			sync_turnstile_layout();
		});

		if (turnstile_container) {
			resize_observer.observe(turnstile_container);
		}

		const interval = window.setInterval(() => {
			if (!(window as TurnstileWindow).turnstile) {
				return;
			}

			sync_turnstile_layout();
			mount_turnstile_widget();
			window.clearInterval(interval);
		}, 250);

		return () => {
			window.clearInterval(interval);
			resize_observer.disconnect();
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (!turnstile_required && turnstile_widget_id && (window as TurnstileWindow).turnstile) {
			(window as TurnstileWindow).turnstile?.remove(turnstile_widget_id);
			turnstile_widget_id = undefined;
			turnstile_token = '';
			turnstile_mount_key += 1;
			return;
		}

		queueMicrotask(() => {
			sync_turnstile_layout();
			mount_turnstile_widget();
		});
	});
</script>

<svelte:head>
	<link rel="preload" as="image" href="/assets/Manga Wallpaper.gif" media="(min-width: 900px)" />
	<script
		src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
		async
		defer
	></script>
</svelte:head>

<div class="body" aria-busy={is_submitting}>
	<div class="login-container">
		<div class="form-container">
			<h1 class="login-title">Login</h1>
			<form method="post" action="?/signInEmail" use:enhance={handle_submit}>
				<fieldset disabled={is_submitting} class="login-fieldset">
					<div class="input-group">
						<label class="login-label">
							Email
							<input
								type="email"
								name="email"
								required
								maxlength="254"
								value={submitted_email}
								oninput={apply_email_validation}
								oninvalid={apply_email_validation}
								class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								placeholder="Enter your email address"
							/>
						</label>
					</div>
					<div class="input-group">
						<label class="login-label">
							Password
							<div class="password-input-wrapper">
								<input
									type={is_password_visible ? 'text' : 'password'}
									name="password"
									required
									maxlength="128"
									oninput={apply_password_validation}
									oninvalid={apply_password_validation}
									class="login-input auth-password-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									placeholder="Enter your password"
								/>
								<button
									type="button"
									class="password-toggle"
									aria-label={is_password_visible ? 'Hide password' : 'Show password'}
									aria-pressed={is_password_visible}
									onclick={() => {
										is_password_visible = !is_password_visible;
									}}
								>
									<img
										src={is_password_visible
											? '/images/login-screen/show-password.avif'
											: '/images/login-screen/hide-password.avif'}
										alt=""
										class="password-toggle-icon"
									/>
								</button>
							</div>
						</label>
					</div>
					{#if turnstile_required}
						<div class="challenge-panel">
							<p class="challenge-badge">Security check</p>
							<p class="challenge-copy">
								Too many failed attempts were detected. Complete the verification to continue.
							</p>
							{#key turnstile_mount_key}
								<div
									bind:this={turnstile_container}
									class="challenge-widget"
									style={`--turnstile-scale: ${turnstile_scale}; min-height: ${turnstile_height}px;`}
								></div>
							{/key}
							<input type="hidden" name="cf-turnstile-response" value={turnstile_token} />
						</div>
					{/if}
					<div class="login-actions">
						<button formaction="?/signInEmail" class="login-button">
							{#if is_submitting}
								<span class="login-spinner" aria-hidden="true"></span>
								Logging in...
							{:else}
								Login
							{/if}
						</button>
						<a
							href={resolve('/sign-up')}
							class="login-button login-signup-link"
							aria-disabled={is_submitting}
							tabindex={is_submitting ? -1 : undefined}
							onclick={(event) => {
								if (is_submitting) {
									event.preventDefault();
								}
							}}>Sign Up</a
						>
					</div>
				</fieldset>
			</form>
			<p class="login-message" aria-live="polite">
				{is_submitting ? '' : form_message}
			</p>
		</div>
		<img
			src="/assets/Manga Wallpaper.gif"
			alt="Login Illustration"
			class="login-img"
			loading="eager"
			decoding="async"
			fetchpriority="high"
		/>
	</div>
	{#if is_submitting}
		<div class="auth-blocking-overlay" role="status" aria-live="polite">
			<span class="auth-overlay-spinner" aria-hidden="true"></span>
			<span>Logging in...</span>
		</div>
	{/if}
</div>

<style>
	.login-container {
		display: grid;
		grid-template-columns: 1fr;
		width: min(100%, 72rem);
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
			min-height: clamp(34rem, 80dvh, 44rem);
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

	.login-fieldset {
		min-width: 0;
		border: 0;
		padding: 0;
		margin: 0;
	}

	.login-input {
		box-sizing: border-box;
		display: block;
		width: 100%;
		font-size: clamp(0.95rem, 2.4vw, 1rem);
		padding: 0.7rem 0.9rem;
		border: 1px solid #d1d5db;
		border-radius: 0.6rem;
		margin-top: 0.45rem;
	}

	.password-input-wrapper {
		width: 100%;
		position: relative;
		margin-top: 0.45rem;
	}

	.password-input-wrapper .login-input {
		margin-top: 0;
		padding-right: 3.4rem;
	}

	.password-toggle {
		position: absolute;
		top: 50%;
		right: 0.7rem;
		display: grid;
		height: 2rem;
		width: 2rem;
		place-items: center;
		transform: translateY(-50%);
		border-radius: 9999px;
		transition:
			background-color 180ms ease,
			opacity 180ms ease;
	}

	.password-toggle-icon {
		height: 2rem;
		width: 2rem;
		object-fit: contain;
	}

	.login-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.875rem;
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

	.login-button:hover:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(-1px);
		box-shadow: 0 12px 22px rgba(43, 45, 87, 0.24);
		filter: brightness(1.03);
	}

	.login-button:active:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(1px) scale(0.985);
		box-shadow: 0 5px 12px rgba(43, 45, 87, 0.18);
		filter: brightness(0.96);
	}

	.login-button:disabled,
	.login-button[aria-disabled='true'] {
		cursor: wait;
		opacity: 0.72;
		transform: none;
		filter: saturate(0.82);
	}

	.login-input:disabled,
	.password-toggle:disabled {
		cursor: wait;
		opacity: 0.68;
	}

	.login-spinner,
	.auth-overlay-spinner {
		display: inline-block;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.45);
		border-top-color: white;
		animation: auth-spin 800ms linear infinite;
	}

	.login-spinner {
		width: 1rem;
		height: 1rem;
	}

	.auth-overlay-spinner {
		width: 1.4rem;
		height: 1.4rem;
	}

	.auth-blocking-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(9, 5, 28, 0.42);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		color: white;
		font-weight: 800;
		letter-spacing: 0;
		pointer-events: all;
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

	.challenge-panel {
		margin-top: 1rem;
		border: 1px solid rgba(71, 85, 105, 0.18);
		border-radius: 1rem;
		padding: 1rem;
		background:
			linear-gradient(145deg, rgba(15, 23, 42, 0.05), rgba(125, 212, 255, 0.16)),
			rgba(255, 255, 255, 0.72);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.6),
			0 14px 30px rgba(43, 45, 87, 0.08);
		overflow: hidden;
	}

	.challenge-badge {
		display: inline-flex;
		margin: 0;
		padding: 0.3rem 0.7rem;
		border-radius: 9999px;
		background: rgba(15, 23, 42, 0.88);
		color: #e0f2fe;
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.challenge-copy {
		margin: 0.75rem 0 0;
		color: #334155;
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.challenge-widget {
		margin-top: 0.85rem;
		min-height: 70px;
		width: 100%;
		max-width: 100%;
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.challenge-widget :global(iframe) {
		display: block;
		transform: scale(var(--turnstile-scale, 1));
		transform-origin: top center;
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
		.login-button,
		.login-spinner,
		.auth-overlay-spinner {
			transition: none;
			animation: none;
			will-change: auto;
		}
	}

	@keyframes auth-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
