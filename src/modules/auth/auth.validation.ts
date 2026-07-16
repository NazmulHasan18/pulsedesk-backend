import { z } from "zod";

const registerCompanySchema = z.object({
  body: z.object({
    companyName: z
      .string({ error: "Company name is required" })
      .min(2, "Company name must be at least 2 characters"),
    adminName: z.string({ error: "Admin name is required" }).min(2, "Name must be at least 2 characters"),
    email: z.string({ error: "Email is required" }).email("Invalid email address"),
    password: z.string({ error: "Password is required" }).min(8, "Password must be at least 8 characters"),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string({ error: "Email is required" }).email("Invalid email address"),
    password: z.string({ error: "Password is required" }),
  }),
});

const superAdminLoginSchema = z.object({
  body: z.object({
    email: z.string({ error: "Email is required" }).email("Invalid email address"),
    password: z.string({ error: "Password is required" }),
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ error: "Refresh token is required" }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string({ error: "Old password is required" }),
    newPassword: z
      .string({ error: "New password is required" })
      .min(8, "Password must be at least 8 characters"),
  }),
});

export const AuthValidation = {
  registerCompanySchema,
  loginSchema,
  superAdminLoginSchema,
  refreshTokenSchema,
  changePasswordSchema,
};
