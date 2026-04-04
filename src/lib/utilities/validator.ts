export type ValidatorOutput = {
	is_Valid: boolean;
	message?: string;
};

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

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
	// Optionally allow middle names by adjusting the logic accordingly
	const trimmed_name = name.trim();
	// Split the name into parts and check if it exceeds the allowed number of parts
	const name_parts = trimmed_name.trim().split(/\s+/);
	// Enforce first/last name only.
	if (name_parts.length > 2) {
		return { is_Valid: false, message: 'Name must not contain more than two parts' };
	}

	const name_regex = /^[a-zA-Z\s]+$/;
	// Check if the name contains special characters
	if (!name_regex.test(trimmed_name)) {
		return { is_Valid: false, message: 'Name cannot contain special characters. Ex. !@#$%^&*()' };
	}
	// Check for minimum and maximum length of the name
	const min_length = 3;
	const max_length = 15;

	if (trimmed_name.length < min_length || trimmed_name.length > max_length) {
		return { is_Valid: false, message: 'Name must be between 3 and 15 characters long' };
	}

	return { is_Valid: true };
};
