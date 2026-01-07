import HttpException from "~/models/http-exception.model";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "POST /api/articles/:slug/comments";
    const slug = getRouterParam(event, "slug");

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const { comment } = await readBody(event);

        console.info("[api]", {
            event: "comment_create_attempt",
            route,
            slug,
            userId: auth.id,
            hasBody: Boolean(comment?.body),
        });

        if (!comment.body) {
            console.warn("[api]", {
                event: "comment_create_validation_failed",
                route,
                slug,
                userId: auth.id,
                reason: "missing_body",
            });
            throw new HttpException(422, { errors: { body: ["can't be blank"] } });
        }

        const article = await usePrisma().article.findUnique({
            where: {
                slug,
            },
            select: {
                id: true,
            },
        });

        const createdComment = await usePrisma().comment.create({
            data: {
                body: comment.body,
                article: {
                    connect: {
                        id: article?.id,
                    },
                },
                author: {
                    connect: {
                        id: auth.id,
                    },
                },
            },
            include: {
                author: {
                    select: {
                        username: true,
                        bio: true,
                        image: true,
                        followedBy: true,
                    },
                },
            },
        });

        console.info("[api]", {
            event: "comment_create_success",
            route,
            slug,
            userId: auth.id,
            commentId: createdComment.id,
        });

        return {
            comment: {
                id: createdComment.id,
                createdAt: createdComment.createdAt,
                updatedAt: createdComment.updatedAt,
                body: createdComment.body,
                author: {
                    username: createdComment.author.username,
                    bio: createdComment.author.bio,
                    image: createdComment.author.image,
                    following: createdComment.author.followedBy.some(
                        (follow: any) => follow.id === auth.id,
                    ),
                },
            },
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
