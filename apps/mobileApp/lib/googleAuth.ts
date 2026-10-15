import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { GOOGLE_WEB_CLIENT_ID } from "./authConfig";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  // webClientId makes Google return an ID token for the web client, which the API verifies.
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
  configured = true;
}

export type GoogleSignInResult =
  | { status: "success"; idToken: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** Opens Google's account picker and returns an ID token for POST /api/auth/google. */
export async function getGoogleIdToken(): Promise<GoogleSignInResult> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Google reuses the account last picked in this app without asking; forgetting it first means
    // the account picker always shows (only Aurora's remembered choice is cleared, not the phone's accounts).
    await GoogleSignin.signOut().catch(() => undefined);
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return { status: "cancelled" };
    const idToken = res.data.idToken;
    if (!idToken) return { status: "error", message: "Google didn't return a sign-in token. Please try again." };
    return { status: "success", idToken };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" };
      if (e.code === statusCodes.IN_PROGRESS) return { status: "cancelled" };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { status: "error", message: "Google Play services is missing or out of date on this phone." };
      }
      // DEVELOPER_ERROR (10): this build's SHA-1 isn't registered on an Android OAuth client in Google Cloud.
      if (String(e.code) === "10" || /DEVELOPER_ERROR/i.test(String(e.message))) {
        return { status: "error", message: "Google sign-in isn't set up for this build yet." };
      }
    }
    return { status: "error", message: "Google sign-in failed. Please try again." };
  }
}

/** Forget the chosen Google account so the picker shows again next time (errors ignored). */
export async function signOutOfGoogle(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // not signed in with Google, or the module isn't available — nothing to do
  }
}
