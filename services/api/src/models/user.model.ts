import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";


export const users = pgTable("users", {

 id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  contactNo: text("contact_no"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isCreator: boolean("is_creator").notNull().default(false),
  isPro: boolean("is_pro").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalUploads: integer("total_uploads").notNull().default(0),
  usernameChangedAt: timestamp("username_changed_at"),
  /** Google account id (ID token `sub`) — set when the user signs in with Google */
  googleId: text("google_id").unique(),
  /** Password-login lockout: 5 failures → locked for 15 minutes */
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  /** "user" | "admin" — admins can use /api/admin (set via scripts/make-admin.mts) */
  role: text("role").notNull().default("user"),
  /** Set by an admin: can't sign in, sessions stop working, live uploads hidden */
  disabledAt: timestamp("disabled_at"),
  disabledReason: text("disabled_reason"),
  disabledBy: uuid("disabled_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  /** Last signed-in request from the website or app (updated at most every 5 min; see utils/lastActive) */
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
}, (t) => [check("users_role_check", sql`${t.role} IN ('user', 'admin')`)]); 