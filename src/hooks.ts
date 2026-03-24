import { deLocalizeUrl } from '$lib/paraglide/runtime';

export const reroute = (request): string => deLocalizeUrl(request.url).pathname;
