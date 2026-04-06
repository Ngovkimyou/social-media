export type PostFeedPost = {
	id: string;
	content: string;
	created_at: Date;
	author_name: string;
	author_username: string;
	author_avatar: string | null;
	media_url: string | null | undefined;
	media_type: 'image' | 'video' | null | undefined;
};
