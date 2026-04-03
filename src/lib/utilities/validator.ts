type ValidatorOutput = {
	is_Valid: boolean;
	message?: string;
};

export const email_validator = (email: string): ValidatorOutput => {
	console.log('@emailValidator => Validating email:', email);
	// email@example.com => ["email", "example", "com"] || [local, domain, tld]
	const [local, domain, tld] = email.split(/[@.]+/);
	// Regular expressions to validate each part of the email
	const local_regex = /^[a-zA-Z0-9]+$/;
	const domain_regex = /^[a-zA-Z0-9]+$/;
	const tld_regex = /^[a-zA-Z]{2,}$/;
	// Check if all parts are present
	console.log('@emailValidator => Email parts:', { local, domain, tld });
	if (!local || !domain || !tld) {
		return { is_Valid: false, message: 'Email must contain local part, domain, and TLD' };
	}
	// Validate each part using the regular expressions
	const is_local_valid = local_regex.test(local);
	if (!is_local_valid) {
		return {
			is_Valid: false,
			message: 'Local part of the email can only contain letters and numbers'
		};
	}
	const is_domain_valid = domain_regex.test(domain);
	if (!is_domain_valid) {
		return {
			is_Valid: false,
			message: 'Domain part of the email can only contain letters and numbers'
		};
	}
	const is_tld_valid = tld_regex.test(tld);
	if (!is_tld_valid) {
		return {
			is_Valid: false,
			message: 'TLD part of the email must be at least 2 characters long and contain only letters'
		};
	}
	console.log('@emailValidator => Validation results:', {
		is_local_valid,
		is_domain_valid,
		is_tld_valid
	});
	// Check if all parts are valid
	const is_Valid: boolean = is_local_valid && is_domain_valid && is_tld_valid;

	return { is_Valid };
};

export const password_validator = (password: string): ValidatorOutput => {
	console.log('@passwordValidator => Validating password:', password);

	const min_length = 8;
	const has_uppercase = /[A-Z]/.test(password);
	// Check for at least one uppercase letter
	if (!has_uppercase) {
		return { is_Valid: false, message: 'Password must contain at least one uppercase letter' };
	}
	// Check for at least one lowercase letter
	const has_lowercase = /[a-z]/.test(password);
	if (!has_lowercase) {
		return { is_Valid: false, message: 'Password must contain at least one lowercase letter' };
	}
	// Check for at least one number
	const has_number = /\d/.test(password);
	if (!has_number) {
		return { is_Valid: false, message: 'Password must contain at least one number' };
	}
	// Check for minimum length
	if (password.length < min_length) {
		return { is_Valid: false, message: 'Password must be at least 8 characters long' };
	}

	return { is_Valid: true };
};

export const name_validator = (name: string): ValidatorOutput => {
	console.log('@nameValidator => Validating name:', name);
	// Optionally allow middle names by adjusting the logic accordingly
	const allow_middle_name = false;
	const trimmed_name = name.trim();
	// Split the name into parts and check if it exceeds the allowed number of parts
	const name_parts = trimmed_name.trim().split(/\s+/);
	// if statement to check if the name contains more than two parts (first and last name) when middle names are not allowed
	if (!allow_middle_name && name_parts.length > 2) {
		return { is_Valid: false, message: 'Name must not contain more than two parts' };
	}

	const name_regex = /^[a-zA-Z\s\d]+$/;
	// Check if the name contains special characters
	if (!name_regex.test(trimmed_name)) {
		return { is_Valid: false, message: 'Name cannot contain special characters. Ex. !@#$%^&*()' };
	}
	// Check for minimum and maximum length of the name
	const min_length = 3;
	const max_length = 15;

	if (name.length < min_length || name.length > max_length) {
		return { is_Valid: false, message: 'Name must be between 3 and 15 characters long' };
	}

	return { is_Valid: true };
};
