import { z } from "zod/v4";

export const createPostInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the post a title.")
    .max(256, "Keep the title under 256 characters."),
  content: z
    .string()
    .trim()
    .min(1, "Write some content before posting.")
    .max(256, "Keep the content under 256 characters."),
});

export const createPostFormSchema = z
  .object({
    title: z.string().nullable(),
    content: z.string().nullable(),
  })
  .transform((value) =>
    createPostInputSchema.parse({
      title: value.title ?? "",
      content: value.content ?? "",
    }),
  );

export type CreatePostFormValues = z.input<typeof createPostFormSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;

export const createPostFormDefaultValues: CreatePostFormValues = {
  title: null,
  content: null,
};
