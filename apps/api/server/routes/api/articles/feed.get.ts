import articleMapper from "~/utils/article.mapper";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "GET /api/articles/feed";

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const query = getQuery(event);

        console.info("[api]", {
            event: "articles_feed_query",
            route,
            userId: auth.id,
            limit: "limit" in query ? Number((query as any).limit) : undefined,
            offset: "offset" in query ? Number((query as any).offset) : undefined,
        });

        const articlesCount = await usePrisma().article.count({
            where: {
                author: {
                    followedBy: { some: { id: auth.id } },
                },
            },
        });

        // TODO fix query
        const articles = await usePrisma().article.findMany({
            where: {
                author: {
                    followedBy: { some: { id: auth.id } },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: Number((query as any).offset) || 0,
            take: Number((query as any).limit) || 10,
            omit: {
                body: true,
                updatedAt: true,
            },
            include: {
                tagList: {
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
            event: "articles_feed_success",
            route,
            userId: auth.id,
            returned: articles.length,
            articlesCount,
        });

        return {
            articles: articles.map((article: any) => articleMapper(article, auth.id)),
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
});
