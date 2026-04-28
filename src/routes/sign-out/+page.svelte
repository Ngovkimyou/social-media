<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData } from './$types';

	const { form }: { form: ActionData } = $props();
	let is_signing_out = $state(false);

	const handle_submit: SubmitFunction = () => {
		is_signing_out = true;

		return async ({ update }) => {
			try {
				await update();
			} finally {
				is_signing_out = false;
			}
		};
	};
</script>

<main class="sign-out-page" aria-busy={is_signing_out}>
	<section class="sign-out-panel">
		<h1>Sign out</h1>
		<form method="post" action="?/signOut" use:enhance={handle_submit}>
			<button class="sign-out-button" disabled={is_signing_out}>
				{#if is_signing_out}
					<span class="sign-out-spinner" aria-hidden="true"></span>
					Logging out...
				{:else}
					Sign out
				{/if}
			</button>
		</form>
		<p aria-live="polite">{is_signing_out ? 'Ending your session...' : (form?.message ?? '')}</p>
	</section>

	{#if is_signing_out}
		<div class="sign-out-overlay" role="status" aria-live="polite">
			<span class="sign-out-overlay-spinner" aria-hidden="true"></span>
			<span>Logging out...</span>
		</div>
	{/if}
</main>

<style>
	.sign-out-page {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: linear-gradient(135deg, #09051c, #26375f 52%, #125b66);
		color: white;
	}

	.sign-out-panel {
		width: min(100%, 24rem);
		padding: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.1);
		box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.24);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	h1 {
		margin: 0 0 1rem;
		font-size: 1.65rem;
		font-weight: 800;
		letter-spacing: 0;
	}

	.sign-out-button {
		display: inline-flex;
		width: 100%;
		min-height: 2.875rem;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		border-radius: 0.6rem;
		background: linear-gradient(90deg, #cd82ff 0%, #7dd4ff 100%);
		padding: 0.7rem 1rem;
		font-weight: 800;
		color: white;
		box-shadow: 0 10px 24px rgba(9, 5, 28, 0.24);
		transition:
			transform 180ms ease,
			filter 180ms ease,
			box-shadow 180ms ease;
	}

	.sign-out-button:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.03);
		box-shadow: 0 14px 28px rgba(9, 5, 28, 0.3);
	}

	.sign-out-button:disabled {
		cursor: wait;
		opacity: 0.74;
	}

	p {
		min-height: 1.4rem;
		margin: 0.85rem 0 0;
		color: rgba(255, 255, 255, 0.78);
	}

	.sign-out-spinner,
	.sign-out-overlay-spinner {
		display: inline-block;
		border-radius: 9999px;
		border: 2px solid rgba(255, 255, 255, 0.45);
		border-top-color: white;
		animation: sign-out-spin 800ms linear infinite;
	}

	.sign-out-spinner {
		width: 1rem;
		height: 1rem;
	}

	.sign-out-overlay-spinner {
		width: 1.45rem;
		height: 1.45rem;
	}

	.sign-out-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(9, 5, 28, 0.56);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
		font-weight: 800;
		pointer-events: all;
	}

	@media (prefers-reduced-motion: reduce) {
		.sign-out-button {
			transition: none;
		}

		.sign-out-spinner,
		.sign-out-overlay-spinner {
			animation: none;
		}
	}

	@keyframes sign-out-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
