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
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"), 
  bio: text("bio"), 
  isCreator: boolean("is_creator").notNull().default(false), 
  isPro: boolean("is_pro").notNull().default(false), 
  stripeCustomerId: text("stripe_customer_id"),
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalUploads: integer("total_uploads").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
}); 