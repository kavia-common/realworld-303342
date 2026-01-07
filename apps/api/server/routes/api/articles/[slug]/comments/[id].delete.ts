import HttpException from "~/models/http-exception.model";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "DELETE /api/articles/:slug/comments/:id";
    const id = Number(getRouterParam(event, "id"));

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        console.info("[api]", {
            event: "comment_delete_attempt",
            route,
            commentId: id,
            userId: auth.id,
        });

        const comment = await usePrisma().comment.findFirst({
            where: {
                id,
                author: {
                    id: auth.id,
                },
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

        if (!comment) {
            console.warn("[api]", {
                event: "comment_delete_not_found",
                route,
                commentId: id,
                userId: auth.id,
            });
            throw new HttpException(404, {});
        }

        if (comment.author.id !== auth.id) {
            console.warn("[api]", {
                event: "comment_delete_forbidden",
                route,
                commentId: id,
                userId: auth.id,
                authorId: comment.author.id,
            });
            throw new HttpException(403, {
                message: "You are not authorized to delete this comment",
            });
        }

        await usePrisma().comment.delete({
            where: {
                id,
            },
        });

        console.info("[api]", {
            event: "comment_delete_success",
            route,
            commentId: id,
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
