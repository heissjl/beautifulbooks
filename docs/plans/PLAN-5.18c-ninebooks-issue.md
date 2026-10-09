<!-- Draft for Julian to post on github.com/jnathan9/ninebooks/issues (ROADMAP 5.18c, 2026-10-09). Not sent. -->

**Title:** Accept already-checked nine-book lists from a partner site (no image)?

Hi! I run [Buy Its Covers](https://buyitscovers.com), a small hobby site that shows the many covers a book has had. One part of it, [Shelf-Portrait](https://buyitscovers.com/shelfportrait), lets people pick their nine favourite books and the cover they love for each, then share the result as a picture.

That is your format exactly, and several people have asked whether their nine could go into Nine Books. Today they would have to save the picture and upload it to you, and then your model reads back titles we already know. Would you consider a way to accept the list directly?

**Why the titles are already checked:** on our side each of the nine is an [Open Library](https://openlibrary.org) work that the reader searched for and chose themselves. There's nothing to recognise and nothing to proofread.

**What I have in mind (happy to adapt to however you'd rather do it):**

- `POST /api/lists/reviewed`, allowed only from origins in a new `PARTNER_ORIGINS` variable, separate from `ALLOWED_ORIGINS`, so a partner can never reach `/api/analyze` or spend your model budget.
- The body is `kind: "book"`, exactly nine `{ title, creator }` passed through your existing `itemRecord`, `consent: "ninebooks-cc0-v2"`, and `attribution` / `display_name` as today.
- Your consent rule stays as it is. On our side the reader sees the nine titles and your CC0 wording, anonymous is pre-selected, and nothing is sent until they click. Their browser posts directly to your API; our server never sees or stores the list.
- Duplicates are caught by a hash of the nine item ids instead of `image_hash`. The same IP quota applies, plus a daily cap of its own; there's no model call.
- A `source` column (`image` / `buyitscovers`) in `lists` and in the export, so anyone using the data can keep photo lists and picked lists apart.
- Optionally, `source_url` could also accept `https://buyitscovers.com/shelfportrait/<id>`, plus a small "via Buy Its Covers" line. Not needed.

If this sounds useful, I'm glad to send a PR with the migration and tests against your current `main`. If you'd rather keep Nine Books photo-only, that's completely fine. For now we simply link to your page and say it's your project.

Thanks for putting the data out in the open!

— Julian
