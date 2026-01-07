import profileMapper from "~/utils/profile.utils";
import { Tag } from "~/models/tag.model";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "POST /api/articles/:slug/favorite";
    const slug = getRouterParam(event, "slug");

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        console.info("[api]", {
            event: "article_favorite_attempt",
            route,
            slug,
            userId: auth.id,
        });

        const { _count, ...article } = await usePrisma().article.update({
            where: {
                slug,
            },
            data: {
                favoritedBy: {
                    connect: {
                        id: auth.id,
                    },
                },
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
                        bio: true,
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

        const result = {
            ...article,
            author: profileMapper(article.author, auth.id),
            tagList: article?.tagList.map((tag: Tag) => tag.name),
            favorited: article.favoritedBy.some((favorited: any) => favorited.id === auth.id),
            favoritesCount: _count?.favoritedBy,
        };

        console.info("[api]", {
            event: "article_favorite_success",
            route,
            slug,
            userId: auth.id,
        });

        return { article: result };
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
