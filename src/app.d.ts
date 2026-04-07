import type { User, Session } from 'better-auth/minimal';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			csp_nonce?: string;
			user?: User;
			session?: Session;
		}
	}
}

export {};
