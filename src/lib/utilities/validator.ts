export type ValidatorOutput = {
	is_Valid: boolean;
	message?: string;
};

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 15;

const normalize_name = (name: string): string => name.normalize('NFKC').trim();

export const email_validator = (email: string): ValidatorOutput => {
	const trimmed_email = email.trim();

	if (trimmed_email.length > MAX_EMAIL_LENGTH) {
		return { is_Valid: false, message: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer` };
	}

	const email_regex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
	if (!email_regex.test(trimmed_email)) {
		return { is_Valid: false, message: 'Please enter a valid email address' };
	}

	return { is_Valid: true };
};

export const password_validator = (password: string): ValidatorOutput => {
	// Check for at least one uppercase letter
	if (!/[A-Z]/.test(password)) {
		return { is_Valid: false, message: 'Password must contain at least one uppercase letter' };
	}
	// Check for at least one lowercase letter
	if (!/[a-z]/.test(password)) {
		return { is_Valid: false, message: 'Password must contain at least one lowercase letter' };
	}
	// Check for at least one number
	if (!/\d/.test(password)) {
		return { is_Valid: false, message: 'Password must contain at least one number' };
	}
	// Check for minimum length
	if (password.length < MIN_PASSWORD_LENGTH) {
		return {
			is_Valid: false,
			message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
		};
	}

	if (password.length > MAX_PASSWORD_LENGTH) {
		return {
			is_Valid: false,
			message: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`
		};
	}

	return { is_Valid: true };
};

export const name_validator = (name: string): ValidatorOutput => {
	const trimmed_name = normalize_name(name);

	if (trimmed_name.length < MIN_NAME_LENGTH || trimmed_name.length > MAX_NAME_LENGTH) {
		return {
			is_Valid: false,
			message: `Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters long`
		};
	}

	if (!/^[\p{L}\p{N}_ ]+$/u.test(trimmed_name)) {
		return {
			is_Valid: false,
			message: 'Name can only contain letters, numbers, spaces, and underscores'
		};
	}

	if (!/\p{L}/u.test(trimmed_name)) {
		return {
			is_Valid: false,
			message: 'Name must include at least one letter'
		};
	}

	const space_count = [...trimmed_name].filter((character) => character === ' ').length;
	if (space_count > 1) {
		return {
			is_Valid: false,
			message: 'Name can contain at most one space'
		};
	}

	const underscore_count = [...trimmed_name].filter((character) => character === '_').length;
	if (underscore_count > 1) {
		return {
			is_Valid: false,
			message: 'Name can contain at most one underscore'
		};
	}

	return { is_Valid: true };
};
