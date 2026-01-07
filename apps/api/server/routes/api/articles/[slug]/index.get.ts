import HttpException from "~/models/http-exception.model";
import articleMapper from "~/utils/article.mapper";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(
    async (event, { auth }) => {
        const startMs = Date.now();
        const route = "GET /api/articles/:slug";
        const slug = getRouterParam(event, "slug");

        console.info("[api]", {
            event: "request_start",
            route,
        });

        try {
            console.info("[api]", {
                event: "article_get_attempt",
                route,
                slug,
                authed: Boolean(auth?.id),
            });

            const article = await usePrisma().article.findUnique({
                where: {
                    slug,
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

            if (!article) {
                console.warn("[api]", {
                    event: "article_get_not_found",
                    route,
                    slug,
                });
                throw new HttpException(404, { errors: { article: ["not found"] } });
            }

            console.info("[api]", {
                event: "article_get_success",
                route,
                slug,
            });

            return { article: articleMapper(article, auth?.id) };
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
