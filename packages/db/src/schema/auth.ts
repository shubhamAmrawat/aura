import { pgTable , uuid , boolean , integer , timestamp , text } from "drizzle-orm/pg-core";
import { users } from "./users";


export const otps = pgTable("otps", {
  id :uuid("id").primaryKey().defaultRandom(), 
  email:text("email").notNull() , 
  code:text("code").notNull(),  
  type:text("type").notNull(), 
  expiresAt:timestamp("expires_at").notNull(),  
  verified:boolean("verified").notNull().default(false),  
  attempts:integer("attempts").notNull().default(0), 
  createdAt:timestamp("created_at").notNull().defaultNow()
}); 

export const sessions = pgTable("sessions", {
  id:uuid("id").primaryKey().defaultRandom(), 
  userId:uuid("user_id").notNull().references(()=>users.id), 
  token:text("token").notNull().unique(), 
  expiresAt:timestamp("expires_at").notNull(), 
  createdAt:timestamp("created_at").notNull().defaultNow()
}); 