export type Post = {
	id: string;
	content: string;
	created_at: Date;
	author_name: string;
	author_username: string;
	author_avatar: string | null;
	media_url: string | null;
	media_type: 'image' | 'video' | null;
};
