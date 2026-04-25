export type ValidatorOutput = {
	is_Valid: boolean;
	message?: string;
};

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 15;
const MAX_PROFILE_BIO_LENGTH = 200;
const MAX_PROFILE_LOCATION_LENGTH = 80;
const MAX_PROFILE_PHONE_LENGTH = 32;

const normalize_name = (name: string): string => name.normalize('NFKC').trim();

export const PROFILE_PHONE_COUNTRY_CODES = ['US', 'JP', 'KH'] as const;
export type ProfilePhoneCountry = (typeof PROFILE_PHONE_COUNTRY_CODES)[number];

type ProfilePhoneRule = {
	country: ProfilePhoneCountry;
	dial_code: string;
	example: string;
	label: string;
	national_digits: number;
	groups: number[];
};

export const PROFILE_PHONE_COUNTRIES: ProfilePhoneRule[] = [
	{
		country: 'US',
		dial_code: '1',
		example: '+1-415-555-2671',
		groups: [3, 3, 4],
		label: 'US',
		national_digits: 10
	},
	{
		country: 'JP',
		dial_code: '81',
		example: '+81-90-1234-5678',
		groups: [2, 4, 4],
		label: 'Japan',
		national_digits: 10
	},
	{
		country: 'KH',
		dial_code: '855',
		example: '+855-12-345-678',
		groups: [2, 3, 3],
		label: 'Cambodia',
		national_digits: 8
	}
];

const PROFILE_PHONE_RULE_BY_COUNTRY = Object.fromEntries(
	PROFILE_PHONE_COUNTRIES.map((rule) => [rule.country, rule])
) as Record<ProfilePhoneCountry, ProfilePhoneRule>;

export const is_profile_phone_country = (value: string): value is ProfilePhoneCountry =>
	(PROFILE_PHONE_COUNTRY_CODES as readonly string[]).includes(value);

const get_profile_phone_rule = (country: ProfilePhoneCountry): ProfilePhoneRule =>
	PROFILE_PHONE_RULE_BY_COUNTRY[country];

const get_profile_phone_digits = (phone: string): string =>
	phone.normalize('NFKC').replaceAll(/\D/g, '');

export const get_profile_phone_country = (phone: string): ProfilePhoneCountry => {
	const digits = get_profile_phone_digits(phone);

	const matched_rule = [...PROFILE_PHONE_COUNTRIES]
		.sort((left, right) => right.dial_code.length - left.dial_code.length)
		.find((rule) => digits.startsWith(rule.dial_code));

	return matched_rule?.country ?? 'US';
};

const get_profile_phone_national_digits = (phone: string, country: ProfilePhoneCountry): string => {
	const rule = get_profile_phone_rule(country);
	const digits = get_profile_phone_digits(phone);
	const without_dial_code = digits.startsWith(rule.dial_code)
		? digits.slice(rule.dial_code.length)
		: digits;

	return without_dial_code.slice(0, rule.national_digits);
};

export const format_profile_phone = (
	phone: string,
	country: ProfilePhoneCountry = get_profile_phone_country(phone)
): string => {
	const national_digits = get_profile_phone_national_digits(phone, country);

	if (!national_digits) {
		return '';
	}

	const rule = get_profile_phone_rule(country);
	const groups: string[] = [];
	let cursor = 0;

	for (const group_length of rule.groups) {
		const group = national_digits.slice(cursor, cursor + group_length);
		if (!group) {
			break;
		}

		groups.push(group);
		cursor += group_length;
	}

	return `+${rule.dial_code}-${groups.join('-')}`;
};

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

export const profile_location_validator = (location: string): ValidatorOutput => {
	const trimmed_location = location.normalize('NFKC').trim();

	if (!trimmed_location) {
		return { is_Valid: true };
	}

	if (trimmed_location.length > MAX_PROFILE_LOCATION_LENGTH) {
		return {
			is_Valid: false,
			message: `Address must be ${MAX_PROFILE_LOCATION_LENGTH} characters or fewer`
		};
	}

	if (/[\p{C}]/u.test(trimmed_location)) {
		return { is_Valid: false, message: 'Address cannot contain hidden control characters' };
	}

	if (!/[\p{L}\p{N}]/u.test(trimmed_location)) {
		return { is_Valid: false, message: 'Address must include at least one letter or number' };
	}

	if (!/^[\p{L}\p{N}\p{M} .,'’、。・/#\-ー－()（）〒]+$/u.test(trimmed_location)) {
		return {
			is_Valid: false,
			message: 'Address can only contain letters, numbers, spaces, and common address symbols'
		};
	}

	return { is_Valid: true };
};

export const profile_bio_validator = (bio: string): ValidatorOutput => {
	const normalized_bio = bio.normalize('NFKC');

	if (normalized_bio.length > MAX_PROFILE_BIO_LENGTH) {
		return {
			is_Valid: false,
			message: `Bio must be ${MAX_PROFILE_BIO_LENGTH} characters or less.`
		};
	}

	const disallowed_control_character = [...normalized_bio].some((character) => {
		if (character === '\n' || character === '\t') {
			return false;
		}

		return /\p{C}/u.test(character);
	});

	if (disallowed_control_character) {
		return { is_Valid: false, message: 'Bio cannot contain hidden control characters' };
	}

	return { is_Valid: true };
};

export const profile_phone_validator = (phone: string): ValidatorOutput => {
	const trimmed_phone = phone.normalize('NFKC').trim();

	if (!trimmed_phone) {
		return { is_Valid: true };
	}

	if (trimmed_phone.length > MAX_PROFILE_PHONE_LENGTH) {
		return {
			is_Valid: false,
			message: `Phone number must be ${MAX_PROFILE_PHONE_LENGTH} characters or fewer`
		};
	}

	if (!/^\+[0-9-]+$/.test(trimmed_phone)) {
		return {
			is_Valid: false,
			message: 'Choose a country and use the suggested phone format'
		};
	}

	const country = get_profile_phone_country(trimmed_phone);
	const rule = get_profile_phone_rule(country);

	if (!trimmed_phone.startsWith(`+${rule.dial_code}-`)) {
		return { is_Valid: false, message: `Phone number must start with +${rule.dial_code}` };
	}

	const national_digits = get_profile_phone_national_digits(trimmed_phone, country);
	if (national_digits.length !== rule.national_digits) {
		return {
			is_Valid: false,
			message: `${rule.label} phone number must match ${rule.example}`
		};
	}

	if (format_profile_phone(trimmed_phone, country) !== trimmed_phone) {
		return {
			is_Valid: false,
			message: `${rule.label} phone number must match ${rule.example}`
		};
	}

	return { is_Valid: true };
};

export const localize_profile_validation_message = (
	message: string,
	locale: string | undefined
): string => {
	if (!locale?.toLowerCase().startsWith('ja')) {
		return message;
	}

	const translations: Record<string, string> = {
		'Address can only contain letters, numbers, spaces, and common address symbols':
			'住所には文字、数字、スペース、一般的な住所記号のみ使用できます',
		'Address cannot contain hidden control characters':
			'住所に非表示の制御文字を含めることはできません',
		'Address must include at least one letter or number':
			'住所には少なくとも1文字または1つの数字を含めてください',
		'Bio cannot contain hidden control characters':
			'自己紹介に非表示の制御文字を含めることはできません',
		'Choose a country and use the suggested phone format':
			'国を選択し、表示された電話番号形式で入力してください',
		'Name can contain at most one space': '名前に使用できるスペースは1つまでです',
		'Name can contain at most one underscore': '名前に使用できるアンダースコアは1つまでです',
		'Name can only contain letters, numbers, spaces, and underscores':
			'名前には文字、数字、スペース、アンダースコアのみ使用できます',
		'Name must include at least one letter': '名前には少なくとも1文字を含めてください',
		'Nickname is required': 'ニックネームは必須です',
		'Please choose a different @username.': '別の@ユーザー名を選択してください。',
		'Please enter a valid address.': '有効な住所を入力してください',
		'Please enter a valid phone number.': '有効な電話番号を入力してください',
		'Phone number must start with +1': '電話番号は+1で始めてください',
		'Phone number must start with +81': '電話番号は+81で始めてください',
		'Phone number must start with +855': '電話番号は+855で始めてください',
		'Username is required': 'ユーザー名は必須です',
		'US phone number must match +1-415-555-2671':
			'USの電話番号は+1-415-555-2671の形式で入力してください',
		'Japan phone number must match +81-90-1234-5678':
			'日本の電話番号は+81-90-1234-5678の形式で入力してください',
		'Cambodia phone number must match +855-12-345-678':
			'カンボジアの電話番号は+855-12-345-678の形式で入力してください'
	};

	const exact_translation = translations[message];
	if (exact_translation) {
		return exact_translation;
	}

	const name_length_match =
		/^(Nickname|Username) must be between (\d+) and (\d+) characters long$/.exec(message);
	if (name_length_match) {
		const label = name_length_match[1] === 'Nickname' ? 'ニックネーム' : 'ユーザー名';
		return `${label}は${name_length_match[2]}文字以上${name_length_match[3]}文字以下で入力してください`;
	}

	const bio_length_match = /^Bio must be (\d+) characters or less\.$/.exec(message);
	if (bio_length_match) {
		return `自己紹介は${bio_length_match[1]}文字以内で入力してください`;
	}

	const address_length_match = /^Address must be (\d+) characters or fewer$/.exec(message);
	if (address_length_match) {
		return `住所は${address_length_match[1]}文字以内で入力してください`;
	}

	const phone_length_match = /^Phone number must be (\d+) characters or fewer$/.exec(message);
	if (phone_length_match) {
		return `電話番号は${phone_length_match[1]}文字以内で入力してください`;
	}

	return message;
};
