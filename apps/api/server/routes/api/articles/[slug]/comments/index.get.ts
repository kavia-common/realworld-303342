import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(
    async (event, { auth }) => {
        const startMs = Date.now();
        const route = "GET /api/articles/:slug/comments";
        const slug = getRouterParam(event, "slug");

        console.info("[api]", {
            event: "request_start",
            route,
        });

        try {
            console.info("[api]", {
                event: "comments_list_attempt",
                route,
                slug,
                authed: Boolean(auth?.id),
            });

            const queries: any[] = [];

            queries.push({
                author: {
                    demo: true,
                },
            });

            if (auth?.id) {
                queries.push({
                    author: {
                        id: auth.id,
                    },
                });
            }

            const comments = await usePrisma().article.findUnique({
                where: {
                    slug,
                },
                include: {
                    comments: {
                        where: {
                            OR: queries,
                        },
                        select: {
                            id: true,
                            createdAt: true,
                            updatedAt: true,
                            body: true,
                            author: {
                                select: {
                                    username: true,
                                    bio: true,
                                    image: true,
                                    followedBy: true,
                                },
                            },
                        },
                    },
                },
            });

            const result = comments?.comments.map((comment: any) => ({
                ...comment,
                author: {
                    username: comment.author.username,
                    bio: comment.author.bio,
                    image: comment.author.image,
                    following: comment.author.followedBy.some((follow: any) => follow.id === auth?.id),
                },
            }));

            console.info("[api]", {
                event: "comments_list_success",
                route,
                slug,
                returned: result?.length ?? 0,
            });

            return { comments: result };
        } catch (err: any) {
            console.error("[api]", {
                event: "request_error",
                route,
                status: err?.statusCode ?? err?.status ?? undefined,
                message: err?.message,
            });
            throw err;
        } finally {
            console.info("[api]", {
                event: "request_end",
                route,
                durationMs: Date.now() - startMs,
            });
        }
    },
    { requireAuth: false },
);
