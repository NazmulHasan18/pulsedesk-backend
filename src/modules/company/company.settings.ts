import { Prisma } from "@prisma/client";
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #4B4FE0");

// An origin is scheme + host (+ port), e.g. https://shop.example.com - no path.
const origin = z
  .string()
  .trim()
  .url("Each allowed origin must be a full URL like https://example.com")
  .transform((value) => new URL(value).origin);

// Everything a company can store in Company.settings. Every key is optional so
// PATCH requests can send only what changed; unknown keys are rejected.
export const companySettingsSchema = z
  .object({
    // Widget
    displayName: z.string().trim().min(1).max(60),
    welcomeMessage: z.string().trim().min(1).max(500),
    primaryColor: hexColor,
    secondaryColor: hexColor,
    widgetEnabled: z.boolean(),
    // Empty list = the widget may be embedded on any website.
    allowedOrigins: z.array(origin).max(20),

    // Support preferences (used by the company settings page)
    supportEmail: z.union([z.email(), z.literal("")]),
    autoAssignAgents: z.boolean(),
    aiFirstResponse: z.boolean(),
    officeHoursTimezone: z.string().max(64),
  })
  .partial()
  .strict();

export type TCompanySettings = z.infer<typeof companySettingsSchema>;

export const WIDGET_DEFAULTS = {
  welcomeMessage: "Hi! 👋 Ask me anything — I'll get you to a human if needed.",
  primaryColor: "#4B4FE0",
  secondaryColor: "#EEF0FF",
  widgetEnabled: true,
  allowedOrigins: [] as string[],
};

// Reads stored settings defensively: anything invalid or unknown is ignored
// instead of breaking the widget.
export const readCompanySettings = (raw: Prisma.JsonValue | null): TCompanySettings => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, unknown> = {};
  const shape = companySettingsSchema.shape;

  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key as keyof typeof shape];
    if (!field) continue;
    const parsed = field.safeParse(value);
    if (parsed.success) result[key] = parsed.data;
  }

  return result as TCompanySettings;
};

export const resolveWidgetSettings = (company: { name: string; settings: Prisma.JsonValue | null }) => {
  const settings = readCompanySettings(company.settings);

  return {
    displayName: settings.displayName ?? company.name,
    welcomeMessage: settings.welcomeMessage ?? WIDGET_DEFAULTS.welcomeMessage,
    primaryColor: settings.primaryColor ?? WIDGET_DEFAULTS.primaryColor,
    secondaryColor: settings.secondaryColor ?? WIDGET_DEFAULTS.secondaryColor,
    widgetEnabled: settings.widgetEnabled ?? WIDGET_DEFAULTS.widgetEnabled,
    allowedOrigins: settings.allowedOrigins ?? WIDGET_DEFAULTS.allowedOrigins,
  };
};

// PATCH semantics: keep existing (valid) settings, overwrite only the keys sent.
// Re-parsing applies trimming and origin normalisation to the incoming values.
export const mergeCompanySettings = (existing: Prisma.JsonValue | null, patch: unknown): Prisma.InputJsonValue => {
  return { ...readCompanySettings(existing), ...companySettingsSchema.parse(patch) } as Prisma.InputJsonValue;
};

// Browser-side embedding guard. An empty allow-list means "any website".
// Requests without an Origin header (server-to-server, curl) can't be checked
// this way and are let through - the session token is what protects data.
export const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]) =>
  !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);
