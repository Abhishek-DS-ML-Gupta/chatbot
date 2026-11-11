# MORTAGI — Intelligent AI Companion & Image Studio

A modern, production-grade personal AI workspace designed for ultra-fast conversational intelligence, photorealistic image creation, and secure multi-user collaboration.

---

## 🌟 Highlights

- ⚡ **Ultra-Fast AI Streaming:** Powered by Groq's high-performance inference engine (`openai/gpt-oss-120b`) via the Vercel AI SDK.
- 🎨 **Multi-Model Image Studio:**
  - **Hugging Face ZeroGPU:** Native `@gradio/client` integration with custom Space deployment (`Lykon/dreamshaper-8`).
  - **Cloudflare Workers AI:** Multi-model generation supporting `@cf/black-forest-labs/flux-1-schnell` and Kling v3.
  - Multi-aspect ratio control (`16:9`, `1:1`, `9:16`) and prompt refinement.
- 🔐 **Robust Authentication:**
  - Email/Password signups & logins.
  - 1-Click Google OAuth 2.0 integration.
  - Official `@supabase/server` token verification & session persistence.
- 🗄️ **Full Database & Storage:**
  - PostgreSQL schema with Row-Level Security (RLS) policies for user isolation.
  - Auto-trigger on signup for user profiles.
  - Dedicated Supabase Storage bucket (`mortagi-files`) for attachments and private user files.
- 🌐 **Modern Full-Stack Architecture:** Built on [TanStack Start](https://tanstack.com/start) + [Nitro](https://nitro.build/) + [Vite](https://vite.dev/) with zero vendor lock-in.

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Full-Stack Framework** | [TanStack Start](https://tanstack.com/start) (Full-stack React with SSR & Server Functions) |
| **Server Engine** | [Nitro](https://nitro.build/) & Vite |
| **Language** | TypeScript (Strict mode) |
| **Styling & UI** | Tailwind CSS v4, Radix UI Primitives, Lucide Icons |
| **Conversational AI** | Groq AI Cloud (`openai/gpt-oss-120b`) via `@ai-sdk/openai` & Vercel AI SDK |
| **Image AI** | Hugging Face ZeroGPU Gradio Space (`@gradio/client`), Cloudflare Workers AI |
| **Database & Auth** | Supabase (PostgreSQL, GoTrue Auth, Storage, `@supabase/server`) |
| **Package Manager** | Bun / npm |

---

## 📁 Project Structure

```text
├── drizzle/                  # Drizzle ORM migrations
│   └── migrations/           # SQL migration history
├── public/                   # Static assets (favicons, robots.txt)
├── src/
│   ├── components/           # Reusable UI components & AI Elements
│   │   ├── ai-elements/      # Chat composers, message views, action bars
│   │   └── ui/               # Radix UI + Tailwind design primitives
│   ├── integrations/         # External service integrations
│   │   └── supabase/         # Browser client, server admin client, auth middleware
│   ├── lib/                  # Application state, chat helpers & contexts
│   │   ├── auth-context.tsx  # React authentication provider
│   │   ├── cloud-chat.ts     # Supabase chat history & message persistence
│   │   └── profile.ts        # User profile resolution
│   ├── routes/               # File-based routing (TanStack Router)
│   │   ├── _authenticated/   # Protected routes (/dashboard, /account)
│   │   ├── api/              # Server-side API endpoints
│   │   │   ├── chat.ts       # Streaming AI chat endpoint (Groq)
│   │   │   └── images.ts     # Image generation endpoint (Hugging Face / Cloudflare)
│   │   ├── auth.tsx          # Login & signup page (Email + Google OAuth)
│   │   ├── chat.$threadId.tsx# Interactive chat conversation view
│   │   ├── images.tsx        # Image Generation Studio UI
│   │   └── __root.tsx        # Root HTML document & shell layout
│   └── styles.css            # Global CSS & Tailwind design tokens
├── supabase/
│   ├── schema.sql            # Complete PostgreSQL database schema & RLS policies
│   └── config.toml           # Supabase CLI project configuration
├── vite.config.ts            # Native Vite + TanStack Start + Nitro configuration
├── .env.example              # Sample environment variables reference
└── package.json              # Dependencies and project scripts
```

---

## 🚀 Quickstart: Local Development

### 1. Prerequisites
- **Node.js** (v20+) or **Bun** (v1.2+) installed.
- Free accounts on:
  - [Groq Console](https://console.groq.com) (for LLM API Key)
  - [Supabase](https://supabase.com) (for Auth & Database)
  - [Hugging Face](https://huggingface.co) (optional, for Image Generation)
  - [Cloudflare](https://dash.cloudflare.com) (optional, for Cloudflare AI images)

### 2. Clone and Install

```bash
git clone https://github.com/Abhishek-DS-ML-Gupta/chatbot.git
cd chatbot

# Install dependencies with Bun
bun install

# Or with npm
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Fill in your configuration:

```env
# ----------------------------------------------------------------------
# 1. Groq AI (Chat Model)
# ----------------------------------------------------------------------
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
GROQ_MODEL="openai/gpt-oss-120b"

# ----------------------------------------------------------------------
# 2. Supabase (Auth, Database, Storage)
# ----------------------------------------------------------------------
SUPABASE_PROJECT_ID="your_project_id"
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxxxxxxx"
SUPABASE_SECRET_KEY="sb_secret_xxxxxxxx"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxxxxxxx"
SUPABASE_JWKS_URL="https://your-project-id.supabase.co/auth/v1/.well-known/jwks.json"

# Client Vite replacements
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxxxxxxx"

# ----------------------------------------------------------------------
# 3. Hugging Face Image Generation (Primary)
# ----------------------------------------------------------------------
HUGGINGFACE_SPACE="AbhishekGGG/Lykon-dreamshaper-8"
HUGGINGFACE_API_KEY="hf_xxxxxxxxxxxxxxxxxxxxxxxx"

# ----------------------------------------------------------------------
# 4. Cloudflare Workers AI (Backup Image Generation)
# ----------------------------------------------------------------------
CLOUDFLARE_API_KEY="cfut_xxxxxxxxxxxxxxxxxxxxxxxx"
CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
CLOUDFLARE_GATEWAY_ID="mortagi"
CLOUDFLARE_IMAGE_MODEL="@cf/black-forest-labs/flux-1-schnell"
```

### 4. Setup Supabase Database

1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project &rarr; Navigate to **SQL Editor** &rarr; **New Query**.
3. Copy the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
   - This sets up the `profiles`, `conversations`, `conversation_messages` tables, triggers, and creates the `mortagi-files` storage bucket.

### 5. Start the Development Server

```bash
# With bun
bun run dev

# Or with npm
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎨 Image Generation Architecture

Mortagi features a hybrid image generation pipeline:

### 1. Hugging Face ZeroGPU Space (`Lykon/dreamshaper-8`)
- Uses `@gradio/client` to interface directly with custom Gradio Spaces running on ZeroGPU.
- Sends prompts to the `/infer` endpoint with automatic enhancement keywords (`8k resolution, photorealistic, sharp focus`) and negative prompt filters to eliminate blur and artifacts.
- Converts the resulting image buffer into base64 data URLs for seamless, cross-origin rendering.

### 2. Cloudflare Workers AI (Flux & Kling)
- Multi-model fallback powered by Cloudflare AI Gateway.
- Supports `@cf/black-forest-labs/flux-1-schnell` for instantaneous generation and Kling v3 for cinematic renders.

---

## 🔐 Authentication & Google OAuth Setup

### 1. Enable Google Sign-In in Supabase
1. In your **Supabase Dashboard**, navigate to **Authentication** &rarr; **Sign In / Providers** &rarr; **Google**.
2. Toggle **Enable Google provider** to **ON**.

### 2. Configure Google Cloud Console
1. Open the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials) page.
2. Click **Create Credentials** &rarr; **OAuth client ID** &rarr; **Application type: Web application**.
3. Under **Authorised redirect URIs**, add your Supabase callback:
   ```text
   https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   ```
4. Leave **Authorised JavaScript origins** empty.
5. Click **Create** and copy the **Client ID** and **Client Secret** into your Supabase Google Provider settings.

### 3. URL Configuration
In **Supabase Dashboard** &rarr; **Authentication** &rarr; **URL Configuration**:
- **Site URL:** `https://your-domain.vercel.app` (or `http://localhost:3000` for local dev)
- **Redirect URLs:**
  ```text
  https://your-domain.vercel.app/**
  https://your-domain.vercel.app/dashboard
  http://localhost:3000/**
  ```

---

## 🚢 Production Deployment on Vercel

### Step 1: Push Code to GitHub

Ensure all your latest changes are pushed to your GitHub repository:

```bash
git add .
git commit -m "Production deployment ready"
git push origin main
```

### Step 2: Import into Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** &rarr; **Project**.
2. Select your `chatbot` repository.
3. Build Settings:
   - **Framework Preset:** `Other` (TanStack Start + Nitro automatically handles the Vercel serverless runtime output).
   - **Build Command:** `vite build` (or leave default)
   - **Output Directory:** `.output`
   - **Install Command:** `bun install` or `npm install`

### Step 3: Add Environment Variables in Vercel

In Vercel **Project Settings** &rarr; **Environment Variables**, add:

```text
GROQ_API_KEY                  = gsk_...
GROQ_MODEL                    = openai/gpt-oss-120b
SUPABASE_URL                  = https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY      = sb_publishable_...
SUPABASE_SECRET_KEY           = sb_secret_...
SUPABASE_SERVICE_ROLE_KEY     = sb_secret_...
SUPABASE_JWKS_URL             = https://<project>.supabase.co/auth/v1/.well-known/jwks.json
VITE_SUPABASE_URL             = https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
HUGGINGFACE_SPACE             = AbhishekGGG/Lykon-dreamshaper-8
HUGGINGFACE_API_KEY           = hf_...
CLOUDFLARE_API_KEY            = cfut_...
CLOUDFLARE_ACCOUNT_ID         = ...
CLOUDFLARE_GATEWAY_ID         = mortagi
```

### Step 4: Deploy

Click **Deploy**. Vercel will build the Nitro server bundle and client assets, generating your production deployment (e.g. `https://mortagi.vercel.app`).

---

## 🧪 Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `bun run dev` | Runs the local development server with HMR on port 3000 |
| `npm run build` / `bun run build` | Compiles the production SSR client and Nitro server output |
| `npm run preview` | Previews the local production build |
| `npm run lint` | Runs ESLint to check code quality |

---

## 🛡️ Security Best Practices

- **Never commit `.env` files**: All secrets and private tokens (`sb_secret_...`, `hf_...`, `gsk_...`, `cfut_...`) must remain in your untracked `.env` file or Vercel environment variables.
- **Row-Level Security (RLS)**: PostgreSQL tables enforce `auth.uid() = user_id`, guaranteeing users can only read and mutate their own chats, messages, and files.
- **Server-Only API Calls**: Chat and image generation model inference occurs strictly in server routes (`/api/chat`, `/api/images`); credentials are never exposed to browser bundles.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
