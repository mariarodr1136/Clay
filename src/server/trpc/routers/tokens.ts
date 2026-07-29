import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { apiTokens } from "@/server/db/schema";
import { generateApiToken } from "@/server/auth/api-token";
import { ForbiddenError, NotFoundError } from "@/server/errors";

export const tokensRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Never selects token_hash. There is nothing the UI can do with it, and
    // not putting it on the wire means it can't end up in a browser cache or
    // a client-side error report.
    return db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        prefix: apiTokens.prefix,
        lastUsedAt: apiTokens.lastUsedAt,
        revokedAt: apiTokens.revokedAt,
        createdAt: apiTokens.createdAt,
        userId: apiTokens.userId,
      })
      .from(apiTokens)
      .where(eq(apiTokens.organizationId, ctx.organizationId))
      .orderBy(desc(apiTokens.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.isGuest) {
        // A demo workspace disappears in a day; a token for it would be a
        // credential that silently stops working.
        throw new ForbiddenError("Create an account to issue API tokens — demo workspaces expire.");
      }

      const { token, tokenHash, prefix } = generateApiToken();
      const [created] = await db
        .insert(apiTokens)
        .values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          name: input.name,
          tokenHash,
          prefix,
        })
        .returning({ id: apiTokens.id, name: apiTokens.name, createdAt: apiTokens.createdAt });

      // The only time the raw token is ever returned. It isn't recoverable
      // afterwards — only its hash is stored.
      return { ...created, token };
    }),

  revoke: protectedProcedure
    .input(z.object({ tokenId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(apiTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiTokens.id, input.tokenId),
            eq(apiTokens.organizationId, ctx.organizationId),
            isNull(apiTokens.revokedAt)
          )
        )
        .returning({ id: apiTokens.id });
      if (!updated) throw new NotFoundError("Token");
      return updated;
    }),
});
