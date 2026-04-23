import { describe, expect, it } from 'vitest';
import { get_name_validation_message } from './auth-form-validation';
import { is_reserved_profile_username, slugify_username } from './profile';

describe('profile username validation', () => {
	it('detects names that generate reserved usernames', () => {
		expect.assertions(4);

		expect(slugify_username('Guest')).toBe('guest');
		expect(is_reserved_profile_username('Guest')).toBe(true);
		expect(is_reserved_profile_username('Admin')).toBe(true);
		expect(is_reserved_profile_username('Ada Lovelace')).toBe(false);
	});

	it('returns a clear validation message for reserved registration names', () => {
		expect.assertions(2);

		expect(get_name_validation_message('guest')).toBe(
			'This name creates a reserved username. Please choose another name.'
		);
		expect(get_name_validation_message('admin')).toBe(
			'This name creates a reserved username. Please choose another name.'
		);
	});
});
