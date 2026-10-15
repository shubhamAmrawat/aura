/** Shows "Continue with Google" on the sign-in screen (native Google Sign-In, see lib/googleAuth.ts). */
export const GOOGLE_SIGN_IN_ENABLED = true;

/**
 * The website's Google OAuth *web* client id. Google issues the app's ID token for this client,
 * which is what POST /api/auth/google already accepts (GOOGLE_CLIENT_ID on the API).
 * The Android OAuth client (package + SHA-1) only has to exist in the same Google Cloud project.
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "395079652521-01nrpcn7o9m965mco4aa0vudvj0ohg1u.apps.googleusercontent.com";

export const TERMS_URL = "https://www.aurora-walls.com/terms-of-service";
export const PRIVACY_URL = "https://www.aurora-walls.com/privacy-policy";
