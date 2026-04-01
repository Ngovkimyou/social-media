export type Post = {
	id: string;
	author: string;
	avatarUrl?: string;
	imageUrl?: string;
	caption?: string;
	createdAt: string;
};

export const load = (): { posts: Post[] } => {
	// Replace this with a real API call when ready
	const posts: Post[] = [
		{ id: '1', author: 'alice', createdAt: '2026-04-01' },
		{ id: '2', author: 'bob', createdAt: '2026-04-01' },
		{ id: '3', author: 'carol', createdAt: '2026-04-01' },
		{ id: '4', author: 'dave', createdAt: '2026-04-01' },
		{ id: '5', author: 'eve', createdAt: '2026-04-01' },
		{ id: '6', author: 'frank', createdAt: '2026-04-01' }
	];

	return { posts };
};

//DEAR MOUYHEANG, This is the +page.ts file for the home route.
// It defines a Post type and a load function that returns a list of posts.
// The posts are currently hardcoded, but you can replace this with an API call
// to fetch real data when you're ready.
//
//-PHEARITH.
// P.S. I HAVE NO IDEA HOW THIS WORKS SO GOOD LUCK.FEEL FREE TO COMPLETELY CHANGE HOW IT SHOULD WORK.
