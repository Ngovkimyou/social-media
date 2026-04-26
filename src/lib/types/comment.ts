export type PostComment = {
	id: string;
	content: string;
	created_at: Date;
	author_id: string;
	author_name: string;
	author_username: string;
	author_avatar: string | null;
};

export type CommentPage = {
	comments: PostComment[];
	has_more: boolean;
	next_cursor?: string;
	total_count: number;
};
