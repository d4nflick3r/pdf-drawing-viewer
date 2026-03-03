import { pgTable, text, varchar, jsonb, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type ToolMode = "select" | "pan" | "measure" | "highlight" | "note" | "scale-set";

export type ScaleUnit = "mm" | "cm" | "m" | "ft" | "in";

export interface DrawingScale {
  pixelsPerUnit: number;
  unit: ScaleUnit;
  drawingRatio: string;
  calibrated: boolean;
}

export interface Annotation {
  id: string;
  type: "highlight" | "note";
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
  note: string;
  color: string;
  createdAt: number;
}

export interface Measurement {
  id: string;
  pageNum: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixelLength: number;
  realLength: number;
  unit: ScaleUnit;
  label: string;
  createdAt: number;
}

export interface ScaleCalibration {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pixelLength: number;
}
