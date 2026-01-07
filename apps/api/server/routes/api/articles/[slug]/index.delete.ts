import HttpException from "~/models/http-exception.model";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "DELETE /api/articles/:slug";
    const slug = getRouterParam(event, "slug");

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        console.info("[api]", {
            event: "article_delete_attempt",
            route,
            slug,
            userId: auth.id,
        });

        const existingArticle = await usePrisma().article.findFirst({
            where: {
                slug,
            },
            select: {
                author: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
        });

        if (!existingArticle) {
            console.warn("[api]", {
                event: "article_delete_not_found",
                route,
                slug,
                userId: auth.id,
            });
            throw new HttpException(404, {});
        }

        if (existingArticle.author.id !== auth.id) {
            console.warn("[api]", {
                event: "article_delete_forbidden",
                route,
                slug,
                userId: auth.id,
                authorId: existingArticle.author.id,
            });
            throw new HttpException(403, {
                message: "You are not authorized to delete this article",
            });
        }

        await usePrisma().article.delete({
            where: {
                slug,
            },
        });

        console.info("[api]", {
            event: "article_delete_success",
            route,
            slug,
            userId: auth.id,
        });
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
