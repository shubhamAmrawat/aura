// Minimal env so config/env.ts validates. No network or DB is used by unit tests.
process.env.DATABASE_URL ??= "postgres://unit:unit@localhost:5432/unit";
process.env.JWT_SECRET = "unit-test-secret";
process.env.ADMIN_SECRET = "unit-admin";
