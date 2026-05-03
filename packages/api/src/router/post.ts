import type { TRPCRouterRecord } from "@trpc/server";

import { z } from "zod/v4";

import { PostRepo } from "@acme/db/repositories";
import { createPostInputSchema } from "@acme/validators";

import { protectedProcedure, publicProcedure } from "../trpc";

// These procedures intentionally depend on the PostRepo service tag rather than
// a promise-shaped repository object. The repository methods stay as Effects,
// and tRPC is the only layer that converts them into Promises.
export const postRouter = {
  all: publicProcedure.query(({ ctx }) => {
    // Public read endpoint: run the PostRepo effect with the runtime injected
    // into ctx by the TanStack Start route handler.
    return ctx.runtime.runPromise(PostRepo.use((repo) => repo.listPosts()));
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      // Keep the id validation at the tRPC boundary, then delegate the database
      // lookup to the Effect repository service.
      return ctx.runtime.runPromise(
        PostRepo.use((repo) => repo.getPostById(input.id)),
      );
    }),

  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(({ ctx, input }) => {
      // protectedProcedure has already refined ctx.session. This mutation only
      // needs to run the Effect program that performs the insert.
      return ctx.runtime.runPromise(
        PostRepo.use((repo) => repo.createPost(input)),
      );
    }),

  delete: protectedProcedure.input(z.string()).mutation(({ ctx, input }) => {
    // Convert to Promise here because tRPC expects handlers to return plain
    // values or Promises, not Effect values.
    return ctx.runtime.runPromise(
      PostRepo.use((repo) => repo.deletePost(input)),
    );
  }),
} satisfies TRPCRouterRecord;
