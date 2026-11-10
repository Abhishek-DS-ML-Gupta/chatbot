<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture

- Chat model calls run only in the `/api/chat` server route (`src/routes/api/chat.ts`), streaming through Lovable AI Gateway Responses (`openai/gpt-6-astra`, helper in `src/lib/chat/responses.ts`); never call the model from client code.
- Conversations are stored in localStorage only (`src/lib/threads.ts`), keyed under `milky:threads` / `milky:thread:<id>:messages`; the user chose browser storage over a database, so no backend tables exist for chat.
- Chat UI is built on AI Elements primitives (`src/components/ai-elements/`); extend them rather than hand-rolling transcript, composer or message primitives.
