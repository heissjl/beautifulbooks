import { SITE_NAME } from '@/lib/seo';

/**
 * Questions and answers under the board (ROADMAP 5.18b; Julian, 2026-10-05:
 * „make a faq similar to my9albums.org. mach einen vorschlag, ich werde dann
 * anpassen und kürzen"). Thirteen questions were proposed; Julian struck four
 * the same day — why this many, how long, another cover, the order — which
 * the page's three steps already say. Nine stand, in the order someone meets
 * them while making a board, and are his to reword: the ones my9albums asks
 * (what it is, no account, the picture's sizes, changing it later) and three
 * it has no reason to: a book the catalogue does not hold, where to buy,
 * whose pictures these are.
 *
 * Every answer is something the page does today. The one on what is stored
 * describes the links' store and is Julian's to approve with the privacy
 * notice before the page goes on in production.
 *
 * No hooks: the editor takes it as `children`, so it is rendered on the
 * server and its words are in the page a crawler reads.
 */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What is a Shelf-Portrait?',
    a: 'A picture of the books that inspire you — three, six or nine of them, each with the cover you love. You put it together here and share it wherever you like.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. No account, no e-mail address, no app. While you build it, your board lives in the address of this page — reload it, and it is still there.',
  },
  {
    q: 'My book, or my cover, is not there.',
    a: (
      <>
        The search asks <a href="https://openlibrary.org" className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent" rel="noopener">Open Library</a>, an open catalogue anyone can add to. Try the original title or the author’s name. A cover nobody has scanned yet cannot be shown here; once it is added there, it can be chosen here too.
      </>
    ),
  },
  {
    q: 'What do I get to share?',
    a: 'A picture for a story (1080 × 1920) or for a post (1080 × 1350), on a ground made from the colours of your covers or on paper, with or without titles and authors under the covers. And a link: posted, it shows as a card with your covers.',
  },
  {
    q: 'Is my name on the picture?',
    a: 'Only if you type one. Without a name the picture says “My Shelf-Portrait”.',
  },
  {
    q: 'Can I change it later?',
    a: 'Yes. Open your link and choose “Start from this one”. A changed board gets a link of its own; the old link keeps showing the old board.',
  },
  {
    q: 'What is stored?',
    a: 'When you press “Done”: the books, their covers and the name you typed, so that the link can show them. Nothing about you, and no cookie.',
  },
  {
    q: 'Where can I buy these editions?',
    a: 'Each cover on a shared board leads to its book’s page: the printings that carried this cover and where to find them, new or used, online or locally.',
  },
  {
    q: 'Whose covers are these?',
    a: `The scans come from Open Library, the Internet Archive’s open catalogue. The designs belong to their publishers and artists; ${SITE_NAME} shows them so that you can tell one edition from another and find the one you mean.`,
  },
];

export default function InspirationFaq() {
  return (
    <section className="mt-16 border-t border-line pt-8" aria-labelledby="faq">
      <h2 id="faq" className="font-display text-2xl text-ink">Questions</h2>
      <div className="mt-4 grid gap-x-12 lg:grid-cols-2">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group border-b border-line py-3">
            <summary className="flex cursor-pointer list-none items-baseline gap-2 text-base text-ink transition-colors hover:text-accent">
              <span className="inline-block text-accent transition-transform group-open:rotate-90">▸</span>
              {q}
            </summary>
            <p className="mt-2 pl-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
