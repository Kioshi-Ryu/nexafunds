import { relations } from "drizzle-orm";
import { budgets, categories, transactions, users } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  budgets: many(budgets),
  categories: many(categories),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
}));
