## Architecture

- Chat model calls run only in the `/api/chat` server route (`src/routes/api/chat.ts`), streaming through Groq AI (`openai/gpt-oss-120b`, helper in `src/lib/chat/responses.ts`); never call the model from client code.
- Conversations are stored in localStorage only (`src/lib/threads.ts`), keyed under `mortagi:threads` / `mortagi:thread:<id>:messages`; the user chose browser storage over a database, so no backend tables exist for chat.
- Chat UI is built on AI Elements primitives (`src/components/ai-elements/`); extend them rather than hand-rolling transcript, composer or message primitives.
