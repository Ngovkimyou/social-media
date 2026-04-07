import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';

const parse_trusted_proxy_ips = (): Set<string> => {
	const configured = env['TRUSTED_PROXY_IPS'] ?? '';
	const entries = configured
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);

	return new Set(entries);
};

const trusted_proxy_ips = parse_trusted_proxy_ips();

const get_server_client_ip = (event: RequestEvent): string | undefined => {
	try {
		const client_ip = event.getClientAddress().trim();
		return client_ip.length ? client_ip : undefined;
	} catch {
		return undefined;
	}
};

export const get_client_ip = (event: RequestEvent): string => {
	const server_ip = get_server_client_ip(event);

	if (server_ip && !trusted_proxy_ips.has(server_ip)) {
		return server_ip;
	}

	const forwarded_for = event.request.headers.get('x-forwarded-for');
	const forwarded_ip = forwarded_for?.split(',')[0]?.trim();

	if (server_ip && trusted_proxy_ips.has(server_ip) && forwarded_ip?.length) {
		return forwarded_ip;
	}

	return server_ip ?? 'unknown-ip';
};
