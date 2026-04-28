# Mobile Release and Tester Distribution

This repository uses GitHub Actions to validate `apps/mobileApp`, build an Android preview APK with EAS, and distribute that APK to testers through Firebase App Distribution.

## Workflows

### PR validation

Workflow: `.github/workflows/mobile-pr-checks.yml`

Trigger:
- pull requests that touch `apps/mobileApp/**`

What it does:
- installs dependencies from `apps/mobileApp/package-lock.json`
- runs `npm run ci:verify`

### Preview distribution

Workflow: `.github/workflows/mobile-preview-distribute.yml`

Triggers:
- pushes to `main` that touch `apps/mobileApp/**`
- manual `workflow_dispatch`

What it does:
- installs `apps/mobileApp` dependencies
- runs `npm run ci:verify`
- builds an Android APK with the `preview` EAS profile
- downloads the APK artifact produced by EAS
- uploads the APK to Firebase App Distribution

## Required GitHub Secrets

Add these repository secrets before enabling the distribution workflow:

- `EXPO_TOKEN`
  - Expo personal access token with access to the Aurora Walls EAS project
- `EXPO_PUBLIC_API_URL`
  - backend URL compiled into the preview build
- `FIREBASE_APP_ID`
  - Firebase Android app ID in the format `1:1234567890:android:abcdef123456`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
  - raw JSON contents of a Google service account key with Firebase App Distribution access
- `FIREBASE_TESTER_GROUPS`
  - optional comma-separated Firebase App Distribution group aliases such as `qa,android-testers`

## External Setup

### Expo / EAS

Make sure the Expo project is already linked and build credentials exist for Android:

- project ID in `apps/mobileApp/app.json` must remain valid
- the `preview` profile in `apps/mobileApp/eas.json` should continue producing an APK
- Android signing credentials must be configured in EAS before the first CI build

Recommended one-time checks:

```bash
cd apps/mobileApp
npx eas whoami
npx eas build:configure
```

### Firebase App Distribution

1. Create or open the Firebase project for the mobile app.
2. Register an Android app with package name `com.shubhzx09.aurorawalls`.
3. Enable App Distribution for that app.
4. Create tester groups like `android-testers` or `qa`.
5. Create a Google service account key that can upload App Distribution releases.

Minimum role recommendation:
- `Firebase App Distribution Admin`

## Local Commands

From `apps/mobileApp`:

```bash
npm run typecheck
npm run ci:verify
npm run build:preview:android
```

`build:preview:android` waits for the EAS build to finish and prints JSON that the GitHub Actions workflow uses to find the generated APK.

## Release Notes Behavior

Manual runs can pass custom release notes through the workflow dispatch form.

Push-based runs default to:

```text
Preview build from <branch> (<short-sha>)
```

## Failure Recovery

### EAS build fails

Check:
- `EXPO_TOKEN` is valid
- Android credentials exist in EAS
- `EXPO_PUBLIC_API_URL` is set
- the `preview` profile still targets `android.buildType = apk`

### Firebase upload fails

Check:
- `FIREBASE_APP_ID` matches the Android Firebase app
- `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON with correct permissions
- `FIREBASE_TESTER_GROUPS` references existing Firebase group aliases

### PR validation fails

Run locally in `apps/mobileApp`:

```bash
npm ci
npm run ci:verify
```

## Suggested Operating Model

- use pull requests for validation only
- use merges to `main` to publish fresh tester builds
- use manual dispatch when you want a one-off QA build with custom release notes
