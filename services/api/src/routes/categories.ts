import { categories, db } from "@aura/db";
import { Hono } from "hono";


export const categoryRoutes = new Hono(); 


categoryRoutes.get("/", async (c) => {
  try {
    const result = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder); 
    
    return c.json({ data: result }); 

  } catch (error) {
    console.log("Categories error:", error);
    return c.json({ error: "Failed to fetch categories" }, 500); 
  }
})