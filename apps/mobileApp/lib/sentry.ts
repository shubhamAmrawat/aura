import * as Sentry from "@sentry/react-native";

/**
 * Crash and error reporting (Sentry project "react-native" in org "aurora-sa", EU region).
 * The DSN only lets the app *send* reports, so it is safe to ship in the app.
 *
 * Release builds send every crash and error. Dev builds send only events tagged
 * `test` (Settings › "Send test error to Sentry"), so everyday dev errors don't fill the
 * dashboard; set EXPO_PUBLIC_SENTRY_DEBUG=1 when starting Metro to send everything.
 */
const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  "https://d9ae89356074996edad83bc1aef879ba@o4512266473832448.ingest.de.sentry.io/4512266921574480";

const sendAllInDev = process.env.EXPO_PUBLIC_SENTRY_DEBUG === "1";

/** Records screen changes (as breadcrumbs and timings); registered in app/_layout.tsx. */
export const navigationIntegration = Sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true });

Sentry.init({
  dsn: DSN,
  environment: __DEV__ ? "development" : "production",
  beforeSend: (event) => (!__DEV__ || sendAllInDev || event.tags?.test ? event : null),
  beforeSendTransaction: (event) => (!__DEV__ || sendAllInDev ? event : null),
  // No IP addresses or other personal data; the signed-in user is attached by id only (AuthContext).
  sendDefaultPii: false,
  // Performance traces for 1 in 5 sessions keeps us well inside the free plan.
  tracesSampleRate: 0.2,
  integrations: [navigationIntegration],
});

export { Sentry };
