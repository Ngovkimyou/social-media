export const email_validator = (email: string): { is_Valid: boolean } => {
	console.log('@emailValidator => Validating email:', email);
	// email@example.com => ["email", "example", "com"] || [local, domain, tld]
	const [local, domain, tld] = email.split(/[@.]+/);
	const local_regex = /^[a-zA-Z0-9._%+-]+$/;
	const domain_regex = /^[a-zA-Z0-9.-]+$/;
	const tld_regex = /^[a-zA-Z]{2,}$/;
	if (!local || !domain || !tld) {
		return { is_Valid: false };
	}
	const is_local_valid = local_regex.test(local);
	const is_domain_valid = domain_regex.test(domain);
	const is_tld_valid = tld_regex.test(tld);
	let is_Valid: boolean = is_local_valid && is_domain_valid && is_tld_valid;

	return { is_Valid };
};

export const password_validator = (password: string): { is_Valid: boolean } => {
	console.log('@passwordValidator => Validating password:', password);
	const min_length = 8;
	const has_uppercase = /[A-Z]/.test(password);
	const has_lowercase = /[a-z]/.test(password);
	const has_number = /\d/.test(password);
	const is_Valid = password.length >= min_length && has_uppercase && has_lowercase && has_number;

	return { is_Valid };
};
