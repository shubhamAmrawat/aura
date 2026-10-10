// Same rules as the API (services/api/src/validators/auth.schema.ts)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8

export const isValidEmail = (email: string) => EMAIL_REGEX.test(email.trim())
