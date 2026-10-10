import { db } from "../config/db";
import { categories } from "../models";

export function listCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder);
}
