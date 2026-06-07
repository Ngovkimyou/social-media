export type PostComment = {
	id: string;
	parent_comment_id: string | null;
	reply_to_comment_id: string | null;
	reply_to_author_id: string | null;
	reply_to_author_name: string | null;
	reply_to_author_username: string | null;
	content: string;
	created_at: Date;
	updated_at: Date;
	author_id: string;
	author_name: string;
	author_username: string;
	author_avatar: string | null;
	is_hidden_for_viewer?: boolean;
	like_count: number;
	has_liked: boolean;
};

export type CommentPage = {
	comments: PostComment[];
	has_more: boolean;
	next_cursor?: string;
	total_count: number;
};
