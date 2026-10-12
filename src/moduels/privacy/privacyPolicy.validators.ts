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

export const policyImageSchema = z.object({
  url: z.string().optional().default(""),
  publicId: z.string().optional().default(""),
  caption: z.string().optional().default(""),
});

export const privacySectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  content: z.string().min(1, "Section content is required"),
  order: z.number().int().optional().default(0),
  icon: z.string().optional().default("Shield"),
  image: policyImageSchema.optional(),
});

export const thirdPartyProcessorSchema = z.object({
  name: z.string().min(1, "Processor name is required"),
  purpose: z.string().min(1, "Processor purpose is required"),
  privacyPolicyUrl: z.string().optional().default(""),
});

export const createPrivacyPolicySchema = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").default("Privacy Policy"),
    slug: z.string().min(2, "Slug must be at least 2 characters").optional().default("privacy-policy"),
    version: z.string().min(1, "Version is required").optional().default("1.0.0"),
    summary: z.string().optional().default(""),
    content: z.string().optional().default(""),
    status: z.enum(["draft", "published", "archived"]).optional().default("published"),
    isCurrent: booleanPreprocess.optional().default(false),
    effectiveDate: z
      .preprocess((val) => (val ? new Date(val as string) : new Date()), z.date())
      .optional(),
    bannerImage: jsonStringPreprocess(policyImageSchema).optional(),
    sections: jsonStringPreprocess(z.array(privacySectionSchema)).optional().default([]),
    thirdPartyProcessors: jsonStringPreprocess(z.array(thirdPartyProcessorSchema)).optional().default([]),
    userRights: jsonStringPreprocess(z.array(z.string())).optional().default([]),
    securityMeasures: jsonStringPreprocess(z.array(z.string())).optional().default([]),
    contactEmail: z.string().email("Invalid contact email address").optional().default("privacy@gochat.ai"),
    retentionPeriod: z.string().optional().default(""),
    cookiePolicySummary: z.string().optional().default(""),
    changelog: z.string().optional().default(""),
  }),
});

export const updatePrivacyPolicySchema = z.object({
  params: z.object({
    id: z.string().min(1, "Policy ID is required"),
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
    bannerImage: jsonStringPreprocess(policyImageSchema).optional(),
    sections: jsonStringPreprocess(z.array(privacySectionSchema)).optional(),
    thirdPartyProcessors: jsonStringPreprocess(z.array(thirdPartyProcessorSchema)).optional(),
    userRights: jsonStringPreprocess(z.array(z.string())).optional(),
    securityMeasures: jsonStringPreprocess(z.array(z.string())).optional(),
    contactEmail: z.string().email("Invalid contact email address").optional(),
    retentionPeriod: z.string().optional(),
    cookiePolicySummary: z.string().optional(),
    changelog: z.string().optional(),
  }),
});

export const policyIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Policy ID is required"),
  }),
});

export const policySlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Policy slug is required"),
  }),
});

export const uploadPolicyImageSchema = z.object({
  body: z.object({
    caption: z.string().optional(),
    imageUrl: z.string().optional(),
  }).optional(),
});

export type CreatePrivacyPolicyInput = z.infer<typeof createPrivacyPolicySchema>["body"];
export type UpdatePrivacyPolicyInput = z.infer<typeof updatePrivacyPolicySchema>["body"];
