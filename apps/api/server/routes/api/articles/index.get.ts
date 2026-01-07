import articleMapper from "~/utils/article.mapper";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(
    async (event, { auth }) => {
        const startMs = Date.now();
        const route = "GET /api/articles";

        console.info("[api]", {
            event: "request_start",
            route,
        });

        try {
            const query = getQuery(event);

            // Log only query summary; avoid dumping full objects.
            console.info("[api]", {
                event: "articles_list_query",
                route,
                author: "author" in query ? (query as any).author : undefined,
                tag: "tag" in query ? (query as any).tag : undefined,
                favorited: "favorited" in query ? (query as any).favorited : undefined,
                limit: "limit" in query ? Number((query as any).limit) : undefined,
                offset: "offset" in query ? Number((query as any).offset) : undefined,
                authed: Boolean(auth?.id),
            });

            const andQueries = buildFindAllQuery(query, auth);
            const articlesCount = await usePrisma().article.count({
                where: {
                    AND: andQueries,
                },
            });

            const articles = await usePrisma().article.findMany({
                omit: {
                    body: true,
                },
                where: { AND: andQueries },
                orderBy: {
                    createdAt: "desc",
                },
                skip: Number((query as any).offset) || 0,
                take: Number((query as any).limit) || 10,
                include: {
                    tagList: {
                        orderBy: {
                            name: "asc",
                        },
                        select: {
                            name: true,
                        },
                    },
                    author: {
                        select: {
                            username: true,
                            image: true,
                            followedBy: true,
                        },
                    },
                    favoritedBy: true,
                    _count: {
                        select: {
                            favoritedBy: true,
                        },
                    },
                },
            });

            console.info("[api]", {
                event: "articles_list_success",
                route,
                returned: articles.length,
                articlesCount,
            });

            return {
                articles: articles.map((article: any) => articleMapper(article, auth?.id)),
                articlesCount,
            };
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

const buildFindAllQuery = (query: any, auth: { id: number } | undefined) => {
    const queries: any = [];
    const orAuthorQuery = [];
    const andAuthorQuery = [];

    orAuthorQuery.push({
        demo: {
            equals: true,
        },
    });

    if (auth?.id) {
        orAuthorQuery.push({
            id: {
                equals: auth?.id,
            },
        });
    }

    if ("author" in query) {
        andAuthorQuery.push({
            username: {
                equals: query.author,
            },
        });
    }

    const authorQuery = {
        author: {
            OR: orAuthorQuery,
            AND: andAuthorQuery,
        },
    };

    queries.push(authorQuery);

    if ("tag" in query) {
        queries.push({
            tagList: {
                some: {
                    name: query.tag,
                },
            },
        });
    }

    if ("favorited" in query) {
        queries.push({
            favoritedBy: {
                some: {
                    username: {
                        equals: query.favorited,
                    },
                },
            },
        });
    }

    return queries;
};
