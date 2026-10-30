import { z } from "zod"
import {
  personNameField,
  emailField,
  optionalPhoneField,
  imageField,
  currentPasswordField,
} from "./fields.js"
export const profileSchema = z.strictObject({
  name: personNameField,
  email: emailField,
  phone: optionalPhoneField,
  avatarUrl: imageField,
})
export const updateProfileSchema = profileSchema.extend({
  currentPassword: z.union([currentPasswordField, z.literal("")]).default(""),
})
export type ProfileView = z.infer<typeof profileSchema>
export type ProfileInput = z.infer<typeof updateProfileSchema>
