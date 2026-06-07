import { get_profile_owner_by_username } from '$lib/server/utilities/profile';
import { json, redirect, type RequestEvent } from '@sveltejs/kit';

export type UploadSignaturePayloadBase = {
	profile_username?: unknown;
};

export const as_number = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const as_string = (value: unknown): string =>
	typeof value === 'string' ? value.trim() : '';

export async function read_owned_upload_signature_payload<T extends UploadSignaturePayloadBase>({
	locals,
	request
}: Pick<RequestEvent, 'locals' | 'request'>): Promise<{ payload: T; user_id: string } | Response> {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const payload = (await request.json()) as T;
	const profile_username = as_string(payload.profile_username);
	const profile_owner = profile_username
		? await get_profile_owner_by_username(profile_username)
		: undefined;

	if (!profile_owner) {
		return json({ message: 'Profile not found.' }, { status: 404 });
	}

	if (profile_owner.user_id !== locals.user.id) {
		return json({ message: 'You can only create posts on your own profile.' }, { status: 403 });
	}

	return { payload, user_id: locals.user.id };
}
