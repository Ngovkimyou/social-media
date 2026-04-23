<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import {
		get_email_validation_message,
		get_name_validation_message,
		get_password_validation_message,
		get_sign_up_password_match_message
	} from '$lib/utilities/auth-form-validation';
	import type { ActionData } from './$types';

	const { form }: { form: ActionData } = $props();
	let is_password_visible = $state(false);
	let sign_up_password = $state('');
	let sign_up_name = $state('');

	type PasswordStrengthTone = 'weak' | 'fair' | 'good' | 'strong' | 'elite';

	const get_password_strength_state = (
		password: string,
		name: string
	): {
		checks: Array<{ is_met: boolean; label: string }>;
		label: string;
		score: 0 | 1 | 2 | 3 | 4;
		tone: PasswordStrengthTone;
	} => {
		const normalized_password = password.normalize('NFKC').trim().toLowerCase();
		const normalized_name = name.normalize('NFKC').trim().toLowerCase();
		const checks = [
			{ is_met: password.length >= 8, label: '8+ characters' },
			{ is_met: /[A-Z]/.test(password), label: 'Uppercase letter' },
			{ is_met: /[a-z]/.test(password), label: 'Lowercase letter' },
			{ is_met: /\d/.test(password), label: 'Number' },
			{ is_met: /[^A-Za-z0-9]/.test(password), label: 'Symbol for extra strength' },
			{
				is_met:
					password.length >= 12 && Boolean(password) && normalized_password !== normalized_name,
				label: 'Longer and not based on your name'
			}
		];

		const met_count = checks.filter((check) => check.is_met).length;

		if (met_count <= 1) {
			return { checks, label: 'Weak', score: 0, tone: 'weak' };
		}

		if (met_count <= 2) {
			return { checks, label: 'Fair', score: 1, tone: 'fair' };
		}

		if (met_count <= 4) {
			return { checks, label: 'Good', score: 2, tone: 'good' };
		}

		if (met_count === 5) {
			return { checks, label: 'Strong', score: 3, tone: 'strong' };
		}

		return { checks, label: 'Excellent', score: 4, tone: 'elite' };
	};

	const password_strength = $derived(get_password_strength_state(sign_up_password, sign_up_name));
	const password_strength_fill_class = $derived(
		password_strength.tone === 'weak'
			? 'from-rose-500 to-orange-400'
			: password_strength.tone === 'fair'
				? 'from-amber-400 to-orange-300'
				: password_strength.tone === 'good'
					? 'from-sky-400 to-cyan-300'
					: password_strength.tone === 'strong'
						? 'from-emerald-400 to-teal-300'
						: 'from-fuchsia-500 to-sky-300'
	);
	const password_strength_hint = $derived(
		password_strength.tone === 'weak'
			? 'Add more variety before you register.'
			: password_strength.tone === 'fair'
				? 'This works, but it is still easy to guess.'
				: password_strength.tone === 'good'
					? 'Nice start. A symbol or longer length would make it stronger.'
					: password_strength.tone === 'strong'
						? 'This is a solid password for your practice account.'
						: 'Excellent. This password has strong variety and length.'
	);

	const apply_email_validation = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_email_validation_message(input.value));
	};

	const apply_name_validation = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		input.setCustomValidity(get_name_validation_message(input.value));
	};

	const apply_sign_up_password_validation = (event: Event): void => {
		const input = event.currentTarget as HTMLInputElement;
		const form = input.form;
		const name = form?.elements.namedItem('name');
		const name_value = name instanceof HTMLInputElement ? name.value : '';
		const password_message =
			get_password_validation_message(input.value) ||
			get_sign_up_password_match_message(input.value, name_value);
		input.setCustomValidity(password_message);
	};
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
						Name
						<input
							type="text"
							name="name"
							minlength="3"
							maxlength="15"
							required
							aria-describedby="name-requirements"
							bind:value={sign_up_name}
							oninput={apply_name_validation}
							oninvalid={apply_name_validation}
							class="login-input rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Choose your display name"
						/>
						<span id="name-requirements" class="sr-only">
							Name must be 3 to 15 characters, can include letters and numbers, may have at most one
							space and one underscore, and must include at least one letter.
						</span>
					</label>
				</div>
				<div class="input-group">
					<label class="login-label">
						Email
						<input
							type="email"
							name="email"
							required
							maxlength="254"
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
								minlength="8"
								maxlength="128"
								required
								pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*"
								title="Password must be 8 to 128 characters and include uppercase, lowercase, and a number."
								aria-describedby="password-requirements"
								bind:value={sign_up_password}
								oninput={apply_sign_up_password_validation}
								oninvalid={apply_sign_up_password_validation}
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
						<span id="password-requirements" class="sr-only">
							Password must be 8 to 128 characters and include uppercase, lowercase, and a number.
						</span>
					</label>
					<div class="password-strength-panel" aria-live="polite">
						<div class="password-strength-header">
							<div>
								<p class="password-strength-kicker">Password strength</p>
								<p class="password-strength-label">{password_strength.label}</p>
							</div>
							<span class="password-strength-score">{password_strength.score + 1}/5</span>
						</div>
						<div class="password-strength-bar" aria-hidden="true">
							<div
								class={`password-strength-bar-fill bg-gradient-to-r ${password_strength_fill_class}`}
								style={`width: ${((password_strength.score + 1) / 5) * 100}%`}
							></div>
						</div>
						<p class="password-strength-hint">{password_strength_hint}</p>
						<div class="password-strength-checks">
							{#each password_strength.checks as check (check.label)}
								<div
									class={`password-strength-check ${check.is_met ? 'password-strength-check-done' : ''}`}
								>
									<span class="password-strength-check-icon" aria-hidden="true">
										{check.is_met ? '✓' : '•'}
									</span>
									<span>{check.label}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<div class="login-actions">
					<a href={resolve('/login')} class="login-button login-secondary-link">Back to Login</a>
					<button formaction="?/signUpEmail" class="login-button">Register</button>
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

	@media (max-width: 899px) {
		.form-container {
			padding: 1.25rem;
		}
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
		border: none;
		background: transparent;
		cursor: pointer;
		z-index: 1;
		transition:
			background-color 180ms ease,
			opacity 180ms ease;
	}

	.password-toggle-icon {
		height: 2rem;
		width: 2rem;
		object-fit: contain;
		pointer-events: none;
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

	.login-actions .login-button:first-child {
		order: 2;
	}

	.login-actions .login-button:last-child {
		order: 1;
	}

	@media (min-width: 520px) {
		.login-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.login-actions .login-button:first-child,
		.login-actions .login-button:last-child {
			order: initial;
		}
	}

	.login-secondary-link {
		background: rgba(255, 255, 255, 0.72);
		color: #2b2d57;
		border: 1px solid rgba(67, 56, 202, 0.16);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 8px 18px rgba(43, 45, 87, 0.1);
	}

	.login-secondary-link:hover {
		filter: brightness(1.01);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.55),
			0 12px 22px rgba(43, 45, 87, 0.14);
	}

	.login-message {
		color: red;
		margin-top: 0.9rem;
		font-size: clamp(0.9rem, 2vw, 1rem);
		min-height: 1.35rem;
	}

	.password-strength-panel {
		margin-top: 0.9rem;
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 1rem;
		padding: 1rem;
		background:
			radial-gradient(circle at top left, rgba(205, 130, 255, 0.18), transparent 45%),
			linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(224, 242, 254, 0.72));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.65),
			0 16px 32px rgba(43, 45, 87, 0.08);
	}

	.password-strength-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.password-strength-kicker {
		margin: 0;
		color: #64748b;
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.password-strength-label {
		margin: 0.18rem 0 0;
		color: #0f172a;
		font-size: 1.05rem;
		font-weight: 800;
	}

	.password-strength-score {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: 0.3rem 0.7rem;
		border-radius: 9999px;
		background: rgba(15, 23, 42, 0.88);
		color: white;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.password-strength-bar {
		margin-top: 0.85rem;
		height: 0.7rem;
		overflow: hidden;
		border-radius: 9999px;
		background: rgba(148, 163, 184, 0.22);
	}

	.password-strength-bar-fill {
		height: 100%;
		border-radius: inherit;
		transition:
			width 220ms ease,
			filter 220ms ease;
		box-shadow: 0 0 24px rgba(125, 212, 255, 0.28);
	}

	.password-strength-hint {
		margin: 0.75rem 0 0;
		color: #334155;
		font-size: 0.92rem;
		line-height: 1.55;
	}

	.password-strength-checks {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.85rem;
	}

	.password-strength-check {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		color: #475569;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.password-strength-check-done {
		color: #0f172a;
	}

	.password-strength-check-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		min-width: 2rem;
		height: 1.55rem;
		border-radius: 9999px;
		background: linear-gradient(135deg, rgba(205, 130, 255, 0.18), rgba(125, 212, 255, 0.24));
		border: 1px solid rgba(125, 212, 255, 0.28);
		color: #4338ca;
		font-size: 0.9rem;
		font-weight: 900;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 8px 18px rgba(125, 212, 255, 0.12);
	}

	.password-strength-check:not(.password-strength-check-done) .password-strength-check-icon {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.16);
		color: #94a3b8;
		box-shadow: none;
	}

	@media (max-width: 519px) {
		.login-container {
			width: min(100%, 32rem);
			border-radius: 1.15rem;
		}

		.password-strength-panel {
			padding: 0.9rem;
			border-radius: 0.9rem;
		}

		.password-strength-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.password-strength-score {
			min-width: 0;
		}
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
