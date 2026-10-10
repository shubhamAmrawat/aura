// Unique id per test file run → every test user/email is traceable and deletable.
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Every test email MUST come from here. Cleanup relies on this exact pattern. */
export function testEmail(n: number | string): string {
  return `aura-test+${RUN_ID}-${n}@example.com`;
}

export function testUsername(n: number | string): string {
  return `t_${RUN_ID}_${n}`;
}

/** LIKE pattern matching only this run's users. */
export const RUN_EMAIL_PATTERN = `aura-test+${RUN_ID}-%@example.com`;

/** LIKE pattern matching every test user ever created (used by the sweeper). */
export const ALL_TEST_EMAIL_PATTERN = "aura-test+%@example.com";
