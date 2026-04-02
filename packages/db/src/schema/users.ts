import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";


export const users = pgTable("users", {

 id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  contactNo: text("contact_no"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isCreator: boolean("is_creator").notNull().default(false),
  isPro: boolean("is_pro").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalUploads: integer("total_uploads").notNull().default(0),
  usernameChangedAt: timestamp("username_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
}); 