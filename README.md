# MORTAGI — AI Companion

Mortagi is a modern, responsive personal AI companion application designed for intelligent conversations, markdown rendering, and code syntax highlighting, powered by high-speed Groq AI models.

---

## ✨ Features

- ⚡ **Ultra-Fast AI Streaming:** Powered by Groq's high-performance inference engine (`openai/gpt-oss-120b`).
- 💬 **Interactive Chat UI:** Built with modern AI elements, supporting rich markdown formatting, copy actions, and real-time streaming.
- 🎨 **Sleek & Clean Design:** Minimalist dark/light adaptive styling crafted with Tailwind CSS.
- 🔐 **Authentication:** Secure user authentication powered by Supabase.
- 📁 **Browser-Persistent Sessions:** Local chat history and session persistence.

---

## 🛠️ Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (Full-stack React)
- **Language:** TypeScript
- **UI & Styling:** React 19, Tailwind CSS v4, Radix UI primitives, Lucide Icons
- **AI SDK:** Vercel AI SDK (`@ai-sdk/openai`, `ai`)
- **Backend / Database:** Supabase

---

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have **Node.js (v18+)** or **Bun** installed on your system.

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Groq AI Configuration
GROQ_API_KEY="your_groq_api_key"
GROQ_MODEL="openai/gpt-oss-120b"

# Supabase Configuration
SUPABASE_URL="your_supabase_url"
SUPABASE_PUBLISHABLE_KEY="your_supabase_publishable_key"
VITE_SUPABASE_URL="your_supabase_url"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_publishable_key"
```

### 3. Install Dependencies

Using npm:
```bash
npm install
```

Or using bun:
```bash
bun install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 📦 Scripts

- `npm run dev` — Starts the local development server
- `npm run build` — Compiles and builds the production application
- `npm run preview` — Locally preview the production build
- `npm run lint` — Lint files with ESLint
