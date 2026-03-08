# BOM Builder

A Bill of Materials builder for converting site takeoffs into priced material lists.

## Features

- **Sections** – Organize materials by category (Framing, Drywall, Insulation, etc.)
- **Formula Engine** – Use `ceil`, `floor`, `round`, `min`, `max`, `abs`, `mod`, `if`, `and`, `or` and more via mathjs
- **Takeoff Variables** – Linear ft, Square ft, Each, Cubic Yards — plus add your own
- **Waste Factor** – Per-material built-in waste multiplier
- **Pricing** – Unit pricing with auto-calculated cost per takeoff unit
- **Projects** – Save and load named estimates
- **Export** – CSV export and browser print

## Local Development

```bash
npm install
npm run dev
```

## Deployment (Cloudflare Pages)

### First-time setup

1. Push this repo to GitHub
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Go to **Workers & Pages → Create → Pages → Connect to Git**
4. Select your repo
5. Set build settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Node version:** `20`
6. Deploy

### Auto-deploy via GitHub Actions

Add these secrets to your GitHub repo (**Settings → Secrets → Actions**):

| Secret | Where to find it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token (use "Edit Cloudflare Workers" template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → right sidebar |

Every push to `main` will automatically build and deploy.

## Formula Reference

Formulas can reference any takeoff variable by its ID (e.g., `linear_ft`, `square_ft`).

| Function | Description |
|----------|-------------|
| `ceil(x)` | Round up |
| `floor(x)` | Round down |
| `round(x, n)` | Round to n decimals |
| `min(a, b)` | Smaller value |
| `max(a, b)` | Larger value |
| `abs(x)` | Absolute value |
| `mod(a, b)` | Remainder |
| `if(cond, a, b)` | Conditional |
| `and(a, b)` | Logical AND |
| `or(a, b)` | Logical OR |

**Note:** Waste factor is applied automatically after formula evaluation — no need to include it in formulas.
