import { z } from "zod";

const jsonStringPreprocess = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, schema);

const booleanPreprocess = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return val;
}, z.boolean());

export const termsImageSchema = z.object({
  url: z.string().optional().default(""),
  publicId: z.string().optional().default(""),
  caption: z.string().optional().default(""),
});

export const termsSectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  content: z.string().min(1, "Section content is required"),
  order: z.number().int().optional().default(0),
  icon: z.string().optional().default("FileText"),
  image: termsImageSchema.optional(),
});

export const createTermsAndConditionSchema = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").default("Terms and Conditions"),
    slug: z.string().min(2, "Slug must be at least 2 characters").optional().default("terms-and-conditions"),
    version: z.string().min(1, "Version is required").optional().default("1.0.0"),
    summary: z.string().optional().default(""),
    content: z.string().optional().default(""),
    status: z.enum(["draft", "published", "archived"]).optional().default("published"),
    isCurrent: booleanPreprocess.optional().default(false),
    effectiveDate: z
      .preprocess((val) => (val ? new Date(val as string) : new Date()), z.date())
      .optional(),
    bannerImage: jsonStringPreprocess(termsImageSchema).optional(),
    sections: jsonStringPreprocess(z.array(termsSectionSchema)).optional().default([]),
    keyHighlights: jsonStringPreprocess(z.array(z.string())).optional().default([]),
    prohibitedActivities: jsonStringPreprocess(z.array(z.string())).optional().default([]),
    governingLaw: z.string().optional().default("Laws of India / Standard Enterprise Jurisdiction"),
    contactEmail: z.string().email("Invalid contact email address").optional().default("legal@gochat.ai"),
    changelog: z.string().optional().default(""),
  }),
});

export const updateTermsAndConditionSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Terms ID is required"),
  }),
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").optional(),
    slug: z.string().min(2, "Slug must be at least 2 characters").optional(),
    version: z.string().min(1, "Version is required").optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    isCurrent: booleanPreprocess.optional(),
    effectiveDate: z
      .preprocess((val) => (val ? new Date(val as string) : undefined), z.date().optional())
      .optional(),
    bannerImage: jsonStringPreprocess(termsImageSchema).optional(),
    sections: jsonStringPreprocess(z.array(termsSectionSchema)).optional(),
    keyHighlights: jsonStringPreprocess(z.array(z.string())).optional(),
    prohibitedActivities: jsonStringPreprocess(z.array(z.string())).optional(),
    governingLaw: z.string().optional(),
    contactEmail: z.string().email("Invalid contact email address").optional(),
    changelog: z.string().optional(),
  }),
});

export const termsIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Terms ID is required"),
  }),
});

export const termsSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Terms slug is required"),
  }),
});

export const uploadTermsImageSchema = z.object({
  body: z.object({
    caption: z.string().optional(),
    imageUrl: z.string().optional(),
  }).optional(),
});

export type CreateTermsAndConditionInput = z.infer<typeof createTermsAndConditionSchema>["body"];
export type UpdateTermsAndConditionInput = z.infer<typeof updateTermsAndConditionSchema>["body"];
