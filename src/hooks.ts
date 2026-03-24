import { deLocalizeUrl } from '$lib/paraglide/runtime';
import type { Reroute, Transport } from '@sveltejs/kit';

export const reroute: Reroute = ({ url }) => deLocalizeUrl(url).pathname;
export const transport: Transport = {};
