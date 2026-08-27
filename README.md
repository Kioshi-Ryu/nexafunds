# nexafund — Personal Finance Dashboard

nexafund is a responsive personal finance dashboard built on the initialized Manus full-stack WebDev template. It combines a React 19/Vite client, an Express server, Drizzle ORM, a MySQL-compatible database, JWT account sessions, and bcryptjs password hashing. The UI includes protected sign-in and registration screens, monthly cash-flow charts, category spending insights, recent transactions, and CRUD-ready transaction, budget, and category flows.

> **Database note:** The provided WebDev full-stack scaffold provisions a MySQL/TiDB-compatible `DATABASE_URL`, so this implementation uses Drizzle with that database rather than MongoDB. The REST API and data boundaries are intentionally organized so a MongoDB/Mongoose adapter can be swapped in later without changing the frontend contract.

## Languages and technology stack

The project is written primarily in **TypeScript**, which is used by both the React client and the Express server. Supporting browser structure and styling use **HTML** and **CSS**, while database migrations use **SQL**.

| Layer | Languages and tools used |
|---|---|
| Frontend | TypeScript, React 19, Vite, Recharts, Lucide React, CSS, and Tailwind CSS tooling |
| Backend | TypeScript, Node.js, Express, JWT via `jose`, bcryptjs, and Zod validation |
| Data | SQL, Drizzle ORM, and MySQL/TiDB-compatible database storage |
| File storage | TypeScript server helpers with S3-compatible object storage for profile images |
| Testing | TypeScript, Vitest, React server rendering, and Playwright browser verification |
| Build tooling | pnpm, Vite, esbuild, Drizzle Kit, and TypeScript compiler |

## Features

| Area | Included behavior |
|---|---|
| Access | Registration, login, JWT bearer sessions, password hashing, protected API requests, account display, sign out, and persistent ISO currency preference |
| Transactions | Create, list, update, and delete income/expense records with amount, category, description, and date |
| Budgets | Monthly category budgets with month/year fields and dashboard budget-versus-spend foundations |
| Categories | User-scoped income and expense categories |
| Dashboard | Balance, income, expenses, monthly budget, recent transactions, cash-flow area chart, category donut chart, and report bar chart, all formatted in the user-selected currency |
| UX | Responsive mobile navigation, desktop sidebar, loading/error toasts, empty states, accessible labels, and compact transaction modal |

## API surface

All routes are mounted by Express under `/api`. Protected routes expect `Authorization: Bearer <jwt>`.

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me` |
| Transactions | `GET /api/transactions`, `POST /api/transactions`, `PUT /api/transactions/:id`, `DELETE /api/transactions/:id` |
| Budgets | `GET /api/budgets`, `POST /api/budgets`, `PUT /api/budgets/:id`, `DELETE /api/budgets/:id` |
| Categories | `GET /api/categories`, `POST /api/categories`, `DELETE /api/categories/:id` |
| Dashboard | `GET /api/dashboard` |

Each write endpoint validates request bodies with Zod, scopes reads and mutations to the authenticated user, and returns JSON error messages with an appropriate HTTP status. Users can set a three-letter ISO 4217 currency code in the account settings; the client uses browser-native international formatting for all monetary values.

## Data model

The Drizzle schema contains `users`, `transactions`, `budgets`, and `categories`. Transactions store `type`, `amount`, `category`, `description`, and a UTC timestamp. Budgets store category, amount, month, and year. Password credentials are stored as a one-way bcrypt hash and are never returned by the API.

## Local setup

1. Install Node.js 20+ and pnpm.
2. Create a `.env` file in the project root and set `DATABASE_URL` to a reachable MySQL/TiDB database. Keep `JWT_SECRET` long and private. The hosted WebDev environment injects its database and platform values automatically.
3. Install dependencies with `pnpm install`.
4. Generate or apply the schema with `pnpm drizzle-kit generate` followed by the migration workflow used by your database environment. The checked-in migration is under `drizzle/0001_nappy_bloodscream.sql`.
5. Start the combined client/server development process with `pnpm dev`. The command uses `cross-env`, so it works in Windows PowerShell, macOS, and Linux.
6. Open the URL printed by the dev server. Register an account, then add transactions from the dashboard.

Useful commands are shown below.

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

### Windows troubleshooting

If account creation shows **“Failed to fetch”**, first confirm that the combined Vite and Express process is still running in the same terminal. Run `pnpm install` after pulling the latest code, add a valid local `.env` file, then run `pnpm dev`. Wait for the `Server running on http://localhost:...` message before opening the address in your browser. The project now uses `cross-env`, so the same `pnpm dev` command works in Windows PowerShell without setting `NODE_ENV` manually.

If the terminal shows a database configuration error, confirm that `.env` contains a reachable MySQL/TiDB-compatible `DATABASE_URL` and a private `JWT_SECRET`. Restart `pnpm dev` after updating environment variables.

Create this file as `C:\Users\laure\Downloads\ABDM\Compressed\nexofund\.env` (replace the database credentials with your own):

```dotenv
DATABASE_URL=mysql://YOUR_DATABASE_USER:YOUR_DATABASE_PASSWORD@127.0.0.1:3306/nexafund
JWT_SECRET=replace-this-with-a-long-random-private-string
```

The database itself must exist and be reachable before registration can succeed. You can use a local MySQL installation, a local TiDB instance, or a hosted MySQL/TiDB-compatible provider. The optional analytics variables are no longer required for local development; the client only loads analytics when both are supplied.

### Recommended local MySQL account

If MySQL reports `Access denied for user 'root'@'localhost'`, use MySQL Workbench to connect with the root password you set during MySQL installation, then run the following commands. Replace `CHANGE_THIS_PASSWORD` with a new password that you choose; do not include the angle brackets.

```sql
CREATE DATABASE IF NOT EXISTS nexafund;
CREATE USER IF NOT EXISTS 'nexafund_app'@'localhost' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON nexafund.* TO 'nexafund_app'@'localhost';
FLUSH PRIVILEGES;
```

Then update `.env` with the matching application account credentials and restart the development server:

```dotenv
DATABASE_URL=mysql://nexafund_app:CHANGE_THIS_PASSWORD@127.0.0.1:3306/nexafund
JWT_SECRET=replace-this-with-a-long-random-private-string
```

If the chosen database password includes `@`, `:`, `/`, `?`, or `#`, encode it in the connection URL before saving `.env`.

## Project layout

```text
client/src/pages/Home.tsx        Auth screens and dashboard UI
client/src/index.css             nexafund visual system and responsive layout
server/api.ts                    Express REST controllers/routes and validation
server/_core/index.ts            Express entrypoint and API mounting
drizzle/schema.ts                Users and finance entities
drizzle/0001_*.sql                Generated schema migration
todo.md                           Implementation checklist
```

The scaffold also includes its built-in Manus OAuth/tRPC infrastructure. The new password-based REST API is mounted alongside it at `/api` so existing platform services remain intact.
