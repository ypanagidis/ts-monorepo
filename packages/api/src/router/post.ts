import type { TRPCRouterRecord } from "@trpc/server";

import { z } from "zod/v4";

import { createPostInputSchema } from "@acme/validators";

import { protectedProcedure, publicProcedure } from "../trpc";

export const postRouter = {
  all: publicProcedure.query(({ ctx }) => {
    return ctx.postRepo.listPosts();
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.postRepo.getPostById(input.id);
    }),

  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(({ ctx, input }) => {
      return ctx.postRepo.createPost(input);
    }),

  delete: protectedProcedure.input(z.string()).mutation(({ ctx, input }) => {
    return ctx.postRepo.deletePost(input);
  }),
} satisfies TRPCRouterRecord;
