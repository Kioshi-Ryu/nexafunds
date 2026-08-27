import { Router, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getBudgetsForUser, getCategoriesForUser, getDb, getTransactionsForUser } from "./db";
import { budgets, categories, transactions, users } from "../drizzle/schema";
import { storagePut } from "./storage";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "local-budget-tracker-secret");
const router = Router();

type AuthRequest = Request & { authUser?: typeof users.$inferSelect };

const asyncRoute = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => handler(req as AuthRequest, res).catch(next);

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    const { payload } = await jwtVerify(token, secret);
    const db = await getDb();
    const [user] = db ? await db.select().from(users).where(eq(users.id, Number(payload.sub))).limit(1) : [];
    if (!user) return res.status(401).json({ message: "Invalid session" });
    (req as AuthRequest).authUser = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid session" });
  }
};

export const accountSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(8).max(100) });
export const profileSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), currency: z.string().regex(/^[A-Z]{3}$/).optional() });
export const profileImageSchema = z.object({ dataUrl: z.string().min(30) });
export function parseProfileImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const image = Buffer.from(match[2], "base64");
  if (image.length > 2 * 1024 * 1024) return null;
  return { contentType: match[1], image };
}
export const transactionSchema = z.object({ type: z.enum(["income", "expense"]), amount: z.coerce.number().positive().max(999999999), category: z.string().trim().min(1).max(80), description: z.string().trim().min(1).max(255), date: z.coerce.date() });
export const categorySchema = z.object({ name: z.string().trim().min(1).max(80), type: z.enum(["income", "expense"]) });
export const budgetSchema = z.object({ category: z.string().trim().min(1).max(80), amount: z.coerce.number().positive().max(999999999), month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2020).max(2100) });

async function issueToken(id: number) {
  return new SignJWT({ scope: "user" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(id)).setIssuedAt().setExpirationTime("7d").sign(secret);
}

router.post("/auth/register", asyncRoute(async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide a valid name, email, and password of at least 8 characters.", issues: parsed.error.flatten() });
  const db = await getDb();
  if (!db) return res.status(503).json({ message: "Database is not configured. Add DATABASE_URL to .env." });
  const email = parsed.data.email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return res.status(409).json({ message: "An account with this email already exists." });
  const [created] = await db.insert(users).values({ openId: nanoid(24), name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12), loginMethod: "password" }).$returningId();
  if (!created?.id) return res.status(500).json({ message: "Could not create account." });
  return res.status(201).json({ token: await issueToken(created.id), user: { id: created.id, name: parsed.data.name, email, currency: "USD", profileImageUrl: null } });
}));

router.post("/auth/login", asyncRoute(async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a valid email and password." });
  const db = await getDb();
  if (!db) return res.status(503).json({ message: "Database is not configured. Add DATABASE_URL to .env." });
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return res.json({ token: await issueToken(user.id), user: { id: user.id, name: user.name, email: user.email, currency: user.currency, profileImageUrl: user.profileImageUrl } });
}));

router.get("/auth/me", requireAuth, asyncRoute(async (req, res) => res.json({ user: { id: req.authUser!.id, name: req.authUser!.name, email: req.authUser!.email, currency: req.authUser!.currency, profileImageUrl: req.authUser!.profileImageUrl } })));
router.patch("/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please provide a valid name, email, and ISO currency code." });
  const db = await getDb();
  if (!db) return res.status(503).json({ message: "Database is not configured." });
  await db.update(users).set({ name: parsed.data.name, email: parsed.data.email.toLowerCase(), ...(parsed.data.currency ? { currency: parsed.data.currency } : {}) }).where(eq(users.id, req.authUser!.id));
  return res.json({ user: { id: req.authUser!.id, name: parsed.data.name, email: parsed.data.email.toLowerCase(), currency: parsed.data.currency || req.authUser!.currency, profileImageUrl: req.authUser!.profileImageUrl } });
}));

router.post("/auth/profile-image", requireAuth, asyncRoute(async (req, res) => {
  const parsed = profileImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Please select a valid image file." });
  const imagePayload = parseProfileImageDataUrl(parsed.data.dataUrl);
  if (!imagePayload) return res.status(400).json({ message: "Use a PNG, JPEG, or WebP image no larger than 2 MB." });
  const { contentType, image } = imagePayload;
  const extension = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
  const key = `profile-images/${req.authUser!.id}/${nanoid(16)}.${extension}`;
  let upload: { key: string; url: string };
  try {
    upload = await storagePut(key, image, contentType);
  } catch (error) {
    console.error("[ProfileImage] upload failed", error);
    return res.status(502).json({ message: "Profile image storage is temporarily unavailable. Please try again shortly." });
  }
  const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." });
  await db.update(users).set({ profileImageKey: upload.key, profileImageUrl: upload.url }).where(eq(users.id, req.authUser!.id));
  return res.status(201).json({ profileImageUrl: upload.url });
}));

router.get("/transactions", requireAuth, asyncRoute(async (req, res) => {
  const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." });
  const rows = await getTransactionsForUser(req.authUser!.id);
  return res.json({ transactions: rows });
}));
router.post("/transactions", requireAuth, asyncRoute(async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid transaction details.", issues: parsed.error.flatten() });
  const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." });
  const [id] = await db.insert(transactions).values({ ...parsed.data, amount: parsed.data.amount.toFixed(2), userId: req.authUser!.id }).$returningId();
  const [created] = await db.select().from(transactions).where(eq(transactions.id, id.id)); return res.status(201).json({ transaction: created });
}));
router.put("/transactions/:id", requireAuth, asyncRoute(async (req, res) => {
  const parsed = transactionSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid transaction details." });
  const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." });
  await db.update(transactions).set({ ...parsed.data, amount: parsed.data.amount.toFixed(2) }).where(and(eq(transactions.id, Number(req.params.id)), eq(transactions.userId, req.authUser!.id)));
  const [updated] = await db.select().from(transactions).where(eq(transactions.id, Number(req.params.id))); return res.json({ transaction: updated });
}));
router.delete("/transactions/:id", requireAuth, asyncRoute(async (req, res) => { const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); await db.delete(transactions).where(and(eq(transactions.id, Number(req.params.id)), eq(transactions.userId, req.authUser!.id))); return res.status(204).send(); }));

router.get("/categories", requireAuth, asyncRoute(async (req, res) => { const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); return res.json({ categories: await getCategoriesForUser(req.authUser!.id) }); }));
router.post("/categories", requireAuth, asyncRoute(async (req, res) => { const parsed = categorySchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid category." }); const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); const [id] = await db.insert(categories).values({ ...parsed.data, userId: req.authUser!.id }).$returningId(); const [created] = await db.select().from(categories).where(eq(categories.id, id.id)); return res.status(201).json({ category: created }); }));
router.put("/categories/:id", requireAuth, asyncRoute(async (req, res) => { const parsed = categorySchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid category." }); const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); await db.update(categories).set(parsed.data).where(and(eq(categories.id, Number(req.params.id)), eq(categories.userId, req.authUser!.id))); const [updated] = await db.select().from(categories).where(eq(categories.id, Number(req.params.id))); return res.json({ category: updated }); }));
router.delete("/categories/:id", requireAuth, asyncRoute(async (req, res) => { const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); await db.delete(categories).where(and(eq(categories.id, Number(req.params.id)), eq(categories.userId, req.authUser!.id))); return res.status(204).send(); }));

router.get("/budgets", requireAuth, asyncRoute(async (req, res) => { const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); return res.json({ budgets: await getBudgetsForUser(req.authUser!.id) }); }));
router.post("/budgets", requireAuth, asyncRoute(async (req, res) => { const parsed = budgetSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid budget details." }); const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); const [id] = await db.insert(budgets).values({ ...parsed.data, amount: parsed.data.amount.toFixed(2), userId: req.authUser!.id }).$returningId(); const [created] = await db.select().from(budgets).where(eq(budgets.id, id.id)); return res.status(201).json({ budget: created }); }));
router.put("/budgets/:id", requireAuth, asyncRoute(async (req, res) => { const parsed = budgetSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "Invalid budget details." }); const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); await db.update(budgets).set({ ...parsed.data, amount: parsed.data.amount.toFixed(2) }).where(and(eq(budgets.id, Number(req.params.id)), eq(budgets.userId, req.authUser!.id))); const [updated] = await db.select().from(budgets).where(eq(budgets.id, Number(req.params.id))); return res.json({ budget: updated }); }));
router.delete("/budgets/:id", requireAuth, asyncRoute(async (req, res) => { const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." }); await db.delete(budgets).where(and(eq(budgets.id, Number(req.params.id)), eq(budgets.userId, req.authUser!.id))); return res.status(204).send(); }));

router.get("/dashboard", requireAuth, asyncRoute(async (req, res) => {
  const db = await getDb(); if (!db) return res.status(503).json({ message: "Database is not configured." });
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rows = await db.select().from(transactions).where(and(eq(transactions.userId, req.authUser!.id), gte(transactions.date, start), lt(transactions.date, end))).orderBy(desc(transactions.date));
  const [budgetRows] = await db.select({ total: sql<string>`coalesce(sum(${budgets.amount}), 0)` }).from(budgets).where(and(eq(budgets.userId, req.authUser!.id), eq(budgets.month, now.getMonth() + 1), eq(budgets.year, now.getFullYear())));
  const income = rows.filter(r => r.type === "income").reduce((a, r) => a + Number(r.amount), 0); const expenses = rows.filter(r => r.type === "expense").reduce((a, r) => a + Number(r.amount), 0);
  const spending = Object.entries(rows.filter(r => r.type === "expense").reduce<Record<string, number>>((a, r) => ({ ...a, [r.category]: (a[r.category] || 0) + Number(r.amount) }), {})).map(([category, amount]) => ({ category, amount }));
  const cashFlow = Array.from({ length: now.getDate() }, (_, i) => { const day = i + 1; const dayRows = rows.filter(r => new Date(r.date).getDate() === day); return { day: String(day), income: dayRows.filter(r => r.type === "income").reduce((a, r) => a + Number(r.amount), 0), expenses: dayRows.filter(r => r.type === "expense").reduce((a, r) => a + Number(r.amount), 0) }; });
  return res.json({ stats: { balance: income - expenses, income, expenses, budget: Number(budgetRows?.total || 0) }, recentTransactions: rows.slice(0, 8), spending, cashFlow });
}));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { console.error(error); res.status(500).json({ message: "Something went wrong. Please try again." }); });
export default router;
