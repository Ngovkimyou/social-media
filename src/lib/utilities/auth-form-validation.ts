import { email_validator, name_validator, password_validator } from '$lib/utilities/validator';
import { slugify_username } from '$lib/server/utilities/profile';

const normalize_for_comparison = (value: string): string =>
	value.normalize('NFKC').trim().toLowerCase();
const is_japanese_locale = (): boolean =>
	typeof navigator !== 'undefined' &&
	navigator.languages.some((locale) => locale.toLowerCase().startsWith('ja'));

const localize_validation_message = (message: string): string => {
	if (!is_japanese_locale()) {
		return message;
	}

	const translated_messages: Record<string, string> = {
		Email: 'メールアドレス',
		Password: 'パスワード',
		Name: '名前',
		'Email is required': 'メールアドレスは必須です',
		'Password is required': 'パスワードは必須です',
		'Name is required': '名前は必須です',
		'Please enter a valid email address': '有効なメールアドレスを入力してください',
		'Password must contain at least one uppercase letter':
			'パスワードには少なくとも1文字の大文字を含めてください',
		'Password must contain at least one lowercase letter':
			'パスワードには少なくとも1文字の小文字を含めてください',
		'Password must contain at least one number':
			'パスワードには少なくとも1文字の数字を含めてください',
		'Invalid password': '無効なパスワードです',
		'Invalid name': '無効な名前です',
		'Name can only contain letters, numbers, spaces, and underscores':
			'名前には文字、数字、スペース、アンダースコアのみ使用できます',
		'Name must include at least one letter': '名前には少なくとも1文字の文字を含めてください',
		'Name can contain at most one space': '名前に使用できるスペースは1つまでです',
		'Name can contain at most one underscore': '名前に使用できるアンダースコアは1つまでです',
		'Password must not match your name or generated username':
			'パスワードは名前または生成されるユーザー名と同じにできません'
	};

	const exact_translation = translated_messages[message];
	if (exact_translation) {
		return exact_translation;
	}

	const name_length_match = /^Name must be between (\d+) and (\d+) characters long$/.exec(message);
	if (name_length_match) {
		return `名前は${name_length_match[1]}文字以上${name_length_match[2]}文字以下で入力してください`;
	}

	const password_min_length_match = /^Password must be at least (\d+) characters long$/.exec(
		message
	);
	if (password_min_length_match) {
		return `パスワードは${password_min_length_match[1]}文字以上で入力してください`;
	}

	const password_max_length_match = /^Password must be (\d+) characters or fewer$/.exec(message);
	if (password_max_length_match) {
		return `パスワードは${password_max_length_match[1]}文字以内で入力してください`;
	}

	const email_max_length_match = /^Email must be (\d+) characters or fewer$/.exec(message);
	if (email_max_length_match) {
		return `メールアドレスは${email_max_length_match[1]}文字以内で入力してください`;
	}

	return message;
};

export const get_email_validation_message = (value: string): string => {
	if (!value.trim()) {
		return localize_validation_message('Email is required');
	}

	const result = email_validator(value);
	return result.is_Valid
		? ''
		: localize_validation_message(result.message ?? 'Please enter a valid email address');
};

export const get_password_validation_message = (value: string): string => {
	if (!value) {
		return localize_validation_message('Password is required');
	}

	const result = password_validator(value);
	return result.is_Valid ? '' : localize_validation_message(result.message ?? 'Invalid password');
};

export const get_name_validation_message = (value: string): string => {
	if (!value.trim()) {
		return localize_validation_message('Name is required');
	}

	const result = name_validator(value);
	return result.is_Valid ? '' : localize_validation_message(result.message ?? 'Invalid name');
};

export const get_sign_up_password_match_message = (password: string, name: string): string => {
	if (!password || !name.trim()) {
		return '';
	}

	const normalized_password = normalize_for_comparison(password);
	const normalized_name = normalize_for_comparison(name);
	const generated_username = slugify_username(name);

	return normalized_password === normalized_name || normalized_password === generated_username
		? localize_validation_message('Password must not match your name or generated username')
		: '';
};
