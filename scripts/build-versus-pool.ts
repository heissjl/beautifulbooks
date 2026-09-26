/**
 * Freezes the cover game's pool into data/versus-pool.json (ROADMAP 5.8a).
 *
 *   npx tsx scripts/build-versus-pool.ts [--images=<scratch dir>]
 *
 * Frozen rather than built per request: the votes in the store name covers,
 * and a pool that shifted with the next build of the index would orphan them.
 * Built data in the repository, read-only at run time — allowed by E18.
 *
 * **Two thousand covers from 499 books** since 2026-09-26 (Julian: "add
 * another 1000 covers, make sure they have good standard like proper scan
 * quality"): up to `PER_BOOK` distinct designs of each book, every book its
 * first before any its second. It grew from the 1000-cover pool of
 * 2026-09-11, which grew from the 200-book pool: the 1000 covers come first,
 * and the votes of both count on its board (`inherits` names each pool, since
 * a pool reads only the logs it names). The thousand it added come from the
 * books the index grew by; every one was looked at on a contact sheet, and
 * what was not a cover went into `EXCLUDED`.
 *
 * **It measures.** A mix takes only covers that fit the game (`fitsGame` in
 * lib/hotornot/pool.ts: sharp enough, not mostly white, not a classic Reclam;
 * and `crispEnough` for a cover the pool adds),
 * and the index holds none of that. So this script fetches Open Library's L
 * image of each cover in exactly the order `mixCandidates` tries them, until
 * the book has `PER_BOOK` that fit, and keeps every measure in
 * data/cover-measures.json: a second run fetches only what is new. A cover that
 * did not answer is not written down — a silent archive.org is not a small
 * image — and is tried again on the next run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor } from '../lib/coverurl';
import { decode } from '../lib/imagehash';
import {
  MAX_ASPECT, MAX_BLUR, MAX_WHITE, MIN_ASPECT, MIN_HEIGHT, RECLAM_CONTRAST, RECLAM_YELLOW, buildPool, crispEnough, fitsGame,
  mixCandidates, poolName,
  type MixOptions, type PoolCover, type RawIndex,
} from '../lib/hotornot/pool';
import { measureCover, type CoverMeasure } from '../lib/hotornot/quality';

const ROOT = join(import.meta.dirname, '..');
const MEASURES_FILE = join(ROOT, 'data', 'cover-measures.json');
const POOL_FILE = join(ROOT, 'data', 'versus-pool.json');
/** Images fetched at once. archive.org is slow, not fast; a few at a time is polite. */
const CONCURRENCY = 6;
const TIMEOUT_MS = 40_000;
const PER_BOOK = 5;
/** Pools this one grew from, oldest first; their votes and reports count on its board. */
const INHERITS = ['mix-200-paperwhite', 'mix-1000-paperwhite'];
/**
 * `--images=<dir>`: keep every L image fetched there, and read it from there
 * next time. For the contact sheets every new cover is looked at on — never a
 * folder in the repository.
 */
const IMAGES = process.argv.find(a => a.startsWith('--images='))?.slice('--images='.length);
if (IMAGES) mkdirSync(IMAGES, { recursive: true });

const EXCLUDED = [
  {
    id: 'ol:10942061',
    reason: 'A Slaughterhouse-Five reading guide with "Note: This is not the actual book cover" printed on it; '
      + 'taken out with the "not a cover" button in the lab test, 2026-09-11.',
  },
  // The four below were seen on the contact sheet of the 61 books the pool grew by, 2026-09-11.
  {
    id: 'ol:13524082',
    reason: 'The Scarlet Letter: a plain placeholder with "Note: This is not the actual book cover" printed on it.',
  },
  {
    id: 'ol:13569803',
    reason: 'The Moonstone: the same kind of placeholder, "Note: This is not the actual book cover".',
  },
  {
    id: 'ol:6352405',
    reason: 'The Woman in White: a page of text from inside the book, not its cover.',
  },
  {
    id: 'ol:14051611',
    reason: 'The Song of Achilles: a merchandise photo of the book beside a tote bag, not the cover itself.',
  },
  {
    id: 'ol:6287717',
    reason: 'Filed under Jane Eyre: a theatre poster ("UR ASAMLET", a Hamlet staging), seen on the standings, 2026-09-11.',
  },
  // Seen on the five contact sheets of the 1000-cover pool, 2026-09-11. Two placeholder templates a
  // seller generated, and flat boards with nothing on them. None of the rules can tell: they are sharp,
  // coloured and not white.
  ...['8770513', '13909028', '13204626'].map(n => ({
    id: `ol:${n}`,
    reason: 'A generated placeholder: title in a box on dark blue, "COVER COMING SOON".',
  })),
  // The last two found by dHash distance ≤ 12 to the ones above; the same search also hit a designed
  // Song of Solomon, so it is a way to look, not a rule.
  ...['8812382', '14260867', '10158974', '13822747', '11556120', '13284909', '13256006'].map(n => ({
    id: `ol:${n}`,
    reason: 'A generated placeholder: title in a box on a flat colour, "Note: This is not the actual book cover".',
  })),
  ...['15122901', '12290731', '12618705', '9327737', '12917662', '13320765', '9442803'].map(n => ({
    id: `ol:${n}`,
    reason: 'A flat board of one colour with nothing on it.',
  })),  // Seen on the 21 contact sheets of the 1000 covers the 2000-cover pool added, 2026-09-26.
  // What no rule catches, because each is sharp, coloured and not white: price and library
  // stickers, library bindings, blank boards, placeholders, title pages, photos and renders
  // of the book as an object, and covers of other books filed under the work.
  { id: 'ol:14509775', reason: "The Prophet: a price sticker with a barcode (\"ONLY $3.99\") stuck across the cover." },
  { id: 'ol:9254711', reason: "The Crucible: a library barcode sticker and a \"Curriculum\" label on the cover." },
  { id: 'ol:14338908', reason: "Une si longue lettre: a library label across the lower corner." },
  { id: 'ol:10520389', reason: "Angels & Demons: a price sticker with a barcode on the cover." },
  { id: 'ol:10526628', reason: "Le avventure di Pinocchio: a barcode sticker on the cover." },
  { id: 'ol:9775195', reason: "Der Schimmelreiter: a library label on the lower corner." },
  { id: 'ol:12962239', reason: "Otcy i deti: a public-library barcode sticker across the title." },
  { id: 'ol:10717150', reason: "Babbitt: library barcode and \"Date due\" stickers on the cover." },
  { id: 'ol:10789038', reason: "Kometen kommer: a barcode sticker across the top." },
  { id: 'ol:8242360', reason: "Struwwelpeter: a library barcode sticker on the cover." },
  { id: 'ol:10658096', reason: "Gitanjali: a barcode sticker across the top." },
  { id: 'ol:10416048', reason: "The Red Badge of Courage: a blacked-out label across the top corner." },
  { id: 'ol:10669200', reason: "El profeta: a barcode sticker in the top corner." },
  { id: 'ol:8383446', reason: "The Time Traveler's Wife: a library barcode sticker on the cover." },
  { id: 'ol:15168574', reason: "Catching Fire: a barcode sticker on the cover." },
  { id: 'ol:9326537', reason: "Rayuela: a barcode sticker across the top." },
  { id: 'ol:12666037', reason: "Memoirs of a Geisha: a \"Midprice 12,50\" sticker on the cover." },
  { id: 'ol:14915154', reason: "The Collector: a plain red board with a library barcode sticker." },
  { id: 'ol:9163838', reason: "The Adventures of Tom Sawyer: price stickers in the top corner." },
  { id: 'ol:14658425', reason: "The Way of Kings: a \"$5.99\" price sticker on the cover." },
  { id: 'ol:13441504', reason: "El Aleph: a library label in the top corner." },
  { id: 'ol:14559640', reason: "A Tree Grows in Brooklyn: a barcode sticker across the top." },
  { id: 'ol:9818349', reason: "Das siebte Kreuz: a library call-number label on the lower corner." },
  { id: 'ol:12651476', reason: "Die Räuber: a library barcode sticker on the cover." },
  { id: 'ol:10656795', reason: "The Princess Bride: a library barcode sticker across the top." },
  { id: 'ol:14340549', reason: "Der Borowski-Betrug: a Seattle Public Library barcode sticker on the cover." },
  { id: 'ol:11725737', reason: "Tao Te Ching: a barcode sticker and a call-number label on the cover." },
  { id: 'ol:12829579', reason: "Die Vermessung der Welt: a public-library barcode sticker along the bottom." },
  { id: 'ol:10696553', reason: "The Crucible: a library barcode and a call-number label on the cover." },
  { id: 'ol:12731757', reason: "The Tenant of Wildfell Hall: a barcode sticker across the top." },
  { id: 'ol:11708026', reason: "Rubáiyát: a black board with a public-library barcode sticker." },
  { id: 'ol:10318730', reason: "La breve y maravillosa vida de Óscar Wao: a barcode sticker at the bottom." },
  { id: 'ol:8445760', reason: "A Time to Kill: a public-library barcode sticker across the top." },
  { id: 'ol:12619638', reason: "I Know Why the Caged Bird Sings: a barcode sticker in the top corner." },
  { id: 'ol:15004327', reason: "L'homme sans qualités: a dark scan with a library barcode sticker." },
  { id: 'ol:12868404', reason: "Waiting for the Barbarians: a library barcode sticker on the cover." },
  { id: 'ol:11006335', reason: "De wijde hemel: a library withdrawal sticker on the cover." },
  { id: 'ol:13556169', reason: "La luz que no puedes ver: a \"Black Friday 6,95 €\" price sticker on the cover." },
  { id: 'ol:12178557', reason: "The Man in the High Castle: a barcode sticker across the top." },
  { id: 'ol:15234819', reason: "Romper el círculo: a public-library barcode sticker across the top." },
  { id: 'ol:15002760', reason: "The Leopard: a barcode sticker on the cover." },
  { id: 'ol:6492648', reason: "Dream of the Red Chamber: a library barcode sticker along the bottom." },
  { id: 'ol:15206073', reason: "El buen nombre: a barcode sticker in the top corner." },
  { id: 'ol:10989924', reason: "The Adventures of Tom Sawyer: a \"Library book, please do not remove from the hospital\" stamp across the bottom." },
  { id: 'ol:6793808', reason: "The Brief Wondrous Life of Oscar Wao: a barcode sticker across the top." },
  { id: 'ol:11963058', reason: "Wagahai wa neko de aru: a library call-number label on the cover." },
  { id: 'ol:756151', reason: "Die Welt von Gestern: a near-black library binding, the title barely legible." },
  { id: 'ol:14589896', reason: "Aeneis: a worn library binding with a call-number label." },
  { id: 'ol:9943003', reason: "The Power and the Glory: a brown library binding with a barcode sticker." },
  { id: 'ol:5698494', reason: "Sult: a library binding with barcode and call number, no title." },
  { id: 'ol:11012119', reason: "Paradise Lost: a dark green library binding with a library label." },
  { id: 'ol:6979252', reason: "Kristin Lavransdatter: a dark green cloth binding, the title barely legible." },
  { id: 'ol:9314747', reason: "The Heart Is a Lonely Hunter: a flat black board with nothing on it." },
  { id: 'ol:15208267', reason: "Die gute Erde: a small title on a plain grey board." },
  { id: 'ol:8757657', reason: "Der Mann ohne Eigenschaften: a plain mustard board with only a monogram on it." },
  { id: 'ol:9704448', reason: "Gaudy Night: a flat black board with only a small publisher's mark." },
  { id: 'ol:10808378', reason: "Sons and Lovers: a flat navy board with nothing on it." },
  { id: 'ol:12882939', reason: "Jurassic Park: a flat black board with nothing on it." },
  { id: 'ol:6980272', reason: "The Stars My Destination: a flat black board with nothing on it." },
  { id: 'ol:14945571', reason: "The Good Earth: a narrow crop of a painted board, a branch without title or author." },
  { id: 'ol:14927836', reason: "Dead Souls: a patterned board or endpaper without title or author." },
  { id: 'ol:6986544', reason: "Ivanhoe: a black board with a gilt frame and nothing else." },
  { id: 'ol:1582115', reason: "Revolutionary Road: a flat slate-blue board with nothing on it." },
  { id: 'ol:12739933', reason: "Decamerone: a flat black board with nothing on it." },
  { id: 'ol:14909061', reason: "Confessions of Zeno: a scan so dark that the design can barely be seen." },
  { id: 'ol:2840394', reason: "Ivanhoe: a generated template, title and author in two plain boxes on a patterned ground." },
  { id: 'ol:13202917', reason: "King Solomon's Mines: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13337161', reason: "Heidi: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:2840931', reason: "Sult: the same generated template as the Ivanhoe, two plain boxes on a patterned ground." },
  { id: 'ol:2894769', reason: "Die Räuber: the same generated template as the Ivanhoe, two plain boxes on a patterned ground." },
  { id: 'ol:13653953', reason: "Quo Vadis: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13549472', reason: "I Am a Cat: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13197464', reason: "The Very Hungry Caterpillar: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13716434', reason: "Filed under Rosemary's Baby: a generated placeholder, title in a box on dark blue, \"COVER COMING SOON\"." },
  { id: 'ol:13763124', reason: "The Tale of Peter Rabbit: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13248528', reason: "A Streetcar Named Desire: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13273587', reason: "The Exorcist: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:8425337', reason: "Duino Elegies: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13311388', reason: "Die Welt von Gestern: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:2894446', reason: "White Fang: the same generated template as the Ivanhoe, two plain boxes on a patterned ground." },
  { id: 'ol:13503791', reason: "Filed under Como agua para chocolate: a generated placeholder, title in a box on dark blue, \"COVER COMING SOON\"." },
  { id: 'ol:8475459', reason: "The Once and Future King: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13782722', reason: "The Firm: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:7051985', reason: "Germinal: a page of text from inside the book, not its cover." },
  { id: 'ol:6520312', reason: "Kristin Lavransdatter: the title page of the 1932 Knopf edition (year, publisher, city), not its cover." },
  { id: 'ol:5568744', reason: "A Portrait of the Artist as a Young Man: the title page of the Egoist edition, not its cover." },
  { id: 'ol:5752332', reason: "Les Fleurs du mal: a title page (Paris, the publisher's address), not the cover." },
  { id: 'ol:14462597', reason: "Émile et les détectives: the title page, not the cover." },
  { id: 'ol:8002251', reason: "Utopia: the title page of the 1685 London printing, not a cover." },
  { id: 'ol:12942310', reason: "Austerlitz: a page of text from inside the book, not its cover." },
  { id: 'ol:5643615', reason: "Uncle Tom's Cabin: the title page of an Altemus edition, not its cover." },
  { id: 'ol:14384231', reason: "The Castle of Otranto: the title page of the 1765 second edition, not a cover." },
  { id: 'ol:14286735', reason: "I promessi sposi: a photograph of a boxed set standing at an angle, not a cover." },
  { id: 'ol:2413514', reason: "The Very Hungry Caterpillar: a product photo of a gift set with a soft toy, not the cover." },
  { id: 'ol:9721303', reason: "Throne of Glass: a rendered product shot of the book lying at an angle, not the cover." },
  { id: 'ol:46511', reason: "Goodnight Moon: the packaging of a book-and-CD set, hanger tab and all." },
  { id: 'ol:10478006', reason: "Franny and Zooey: a washed-out grey photo of the white cover, the title barely legible." },
  { id: 'ol:14262310', reason: "En man som heter Ove: a rendered product shot of the book standing at an angle." },
  { id: 'ol:13297055', reason: "Le avventure di Pinocchio: a photo of the book lying at an angle on a grey ground." },
  { id: 'ol:14578566', reason: "Rubáiyát: a photo of the book standing at an angle, not the cover." },
  { id: 'ol:15112382', reason: "Der Mann ohne Eigenschaften: a photo of a boxed set standing at an angle." },
  { id: 'ol:13790962', reason: "The Curious Incident of the Dog in the Night-Time: a photo of the book at an angle, the table visible around it." },
  { id: 'ol:13268358', reason: "El pájaro canta hasta morir: a photo of the book standing at an angle, not the cover." },
  { id: 'ol:26837', reason: "The Bad Beginning: a photo of a boxed set standing at an angle." },
  { id: 'ol:12369565', reason: "Ready Player One: a rendered product shot of the book at an angle." },
  { id: 'ol:11749510', reason: "Becoming: a photo of the book at an angle, not the cover." },
  { id: 'ol:8776761', reason: "The Last Unicorn: a photo of a worn copy at an angle, not a scan of the cover." },
  { id: 'ol:15127740', reason: "Vlammen (Catching Fire): a rendered product shot of the book at an angle." },
  { id: 'ol:8790649', reason: "Green Eggs and Ham: a photo of a worn copy at an angle, spine and all." },
  { id: 'ol:13502549', reason: "Die Nebel von Avalon: a photo of the book standing crooked on white." },
  { id: 'ol:10504046', reason: "The Tenant of Wildfell Hall: a rendered product shot of the book at an angle." },
  { id: 'ol:13484187', reason: "Strangers on a Train: a photo of the hardback standing at an angle." },
  { id: 'ol:14320478', reason: "Death of a Salesman: the cover of a Philip Allan literature study guide, not of the play." },
  { id: 'ol:10679216', reason: "Filed under Kokoro: the cover of another book, Sawako Ariyoshi's The Doctor's Wife." },
  { id: 'ol:779344', reason: "Filed under Jaws: the cover of another book, Carl Gottlieb's The Jaws Log." },
  { id: 'ol:7432390', reason: "Filed under Sofies verden: the cover of another book, Anaïs Nin's Incesto." },
  { id: 'ol:13199443', reason: "Filed under La nausée: the cover of a study, Sartre's Nausea: Text, Context, Intertext." },
  // The covers that took their place, on a second round of sheets: the same kinds, and two yellow Reclam booklets.
  { id: 'ol:11396441', reason: "Le Parc jurassique: a barcode sticker along the edge." },
  { id: 'ol:8236894', reason: "Rubáiyát: a worn green board with a barcode sticker." },
  { id: 'ol:14559628', reason: "A Tree Grows in Brooklyn: a round public-library sticker on the cover." },
  { id: 'ol:11430562', reason: "De hut van oom Tom: a barcode sticker along the bottom." },
  { id: 'ol:8236893', reason: "Rubáiyát: a barcode sticker in the top corner." },
  { id: 'ol:10658674', reason: "The Adventures of Tom Sawyer: a public-library barcode sticker across the top." },
  { id: 'ol:15204063', reason: "I Know Why the Caged Bird Sings: a barcode sticker in the top corner." },
  { id: 'ol:8236278', reason: "Ivanhoe: a dark library binding with a library label." },
  { id: 'ol:9469861', reason: "Kristin Lavransdatter: a dark brown cloth binding, the title barely legible." },
  { id: 'ol:12947777', reason: "Les Fleurs du mal: a blue library binding with a call number." },
  { id: 'ol:10776471', reason: "White Fang: a flat navy cloth board with nothing on it." },
  { id: 'ol:15047617', reason: "Quo Vadis: a plain tan board with only a small medallion, no title." },
  { id: 'ol:14559629', reason: "A Tree Grows in Brooklyn: a plain red board with nothing on it." },
  { id: 'ol:7188410', reason: "Duineser Elegien: a plain tan board with nothing on it." },
  { id: 'ol:14090424', reason: "The Tenant of Wildfell Hall: a generated template, the author in a black box over a white field." },
  { id: 'ol:13521860', reason: "Kokoro: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13835861', reason: "Tao Te Ching: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:13490531', reason: "The Thorn Birds: a placeholder with \"Note: This is not the actual book cover\" printed on it." },
  { id: 'ol:11152315', reason: "Gaudy Night: a generated placeholder, title in a box on dark blue, \"COVER COMING SOON\"." },
  { id: 'ol:15248632', reason: "The Bad Beginning: the first page of chapter one, not the cover." },
  { id: 'ol:5636808', reason: "Paradise Lost: the title page of an 1804 London edition, not a cover." },
  { id: 'ol:13835559', reason: "Sophie's World: a photo of the book standing at an angle on grey." },
  { id: 'ol:5698291', reason: "The Decameron: a photo of a worn Everyman copy held at an angle." },
  { id: 'ol:13486799', reason: "The Tale of Peter Rabbit in French: a photo of the book with a dark border around it." },
  { id: 'ol:12181666', reason: "The Castle of Otranto: a photo of a stack of books, spines out." },
  { id: 'ol:13507265', reason: "Die Welt von Gestern: a photo of a plain grey volume lying on white." },
  { id: 'ol:13241038', reason: "King Solomon's Mines: a photo of a plain black volume lying on white." },
  { id: 'ol:13741976', reason: "Strangers on a Train: a photo of a worn paperback lying at an angle on grey." },
  { id: 'ol:13027729', reason: "Kollekcioner (The Collector): a rendered product shot of the book, spine and all." },
  { id: 'ol:14043234', reason: "El hombre sin atributos: a photo of a boxed set standing at an angle." },
  { id: 'ol:118916', reason: "Filed under Sons and Lovers: the cover of another book, The New Oxford Book of Children's Verse." },
  { id: 'ol:14534748', reason: "Filed under It Ends with Us: the cover of another book, a Portuguese thriller (Procurada)." },
  { id: 'ol:8236934', reason: "Filed under Germinal: the cover of a magazine, Les Hommes du Jour, with a tribute to Zola." },
  { id: 'ol:15239122', reason: "Filed under The Exorcist: a picture of the child Krishna, not a cover of the book." },
  { id: 'ol:12540925', reason: "Die Räuber: a worn yellow Reclam booklet; its woodcut lifts the contrast past the Reclam rule." },
  { id: 'ol:14564989', reason: "Schraubendrehungen: a yellow Reclam booklet; its drawing lifts the contrast past the Reclam rule." },
  // A third round, on the covers that replaced the second.
  { id: 'ol:9382687', reason: "White Fang: a \"$3.99\" price sticker on the cover." },
  { id: 'ol:11602725', reason: "Rubáiyát: a barcode sticker across the top." },
  { id: 'ol:14559649', reason: "A Tree Grows in Brooklyn: a flat dark green board with nothing on it." },
  { id: 'ol:12949630', reason: "Les Fleurs du mal: a flat black board with nothing on it." },
  { id: 'ol:12739944', reason: "Decamerone: a plain red board with nothing on it." },
  { id: 'ol:12049771', reason: "The Adventures of Tom Sawyer: a generated template, title between two black bars on white." },
  { id: 'ol:8741232', reason: "The Castle of Otranto: a generated template, the author in a black box over a white field." },
  { id: 'ol:10448092', reason: "The Collector: a stock picture of a book with \"NOT REAL BOOK IMAGE\" printed on it." },
  { id: 'ol:6094086', reason: "Rubáiyát: the title page of an 1896 Boston edition, not a cover." },
  { id: 'ol:6018370', reason: "Paradise Lost: a page of the introduction, not the cover." },
  { id: 'ol:13698000', reason: "Decamerone: a photo of two volumes standing at an angle." },
  { id: 'ol:14528530', reason: "Filed under Uncle Tom's Cabin: the cover of another book, Lilian Wright's The Mack Family." },
  { id: 'ol:13836237', reason: "Die Räuber: another scan of the yellow Reclam booklet with the woodcut." },
  // A fourth round.
  { id: 'ol:8235466', reason: "Paradise Lost: a library binding with a barcode and a call number." },
  { id: 'ol:13535685', reason: "Filed under the Decameron: a generated placeholder, title in a box on dark blue, \"COVER COMING SOON\"." },
  { id: 'ol:13667199', reason: "Rubáiyát: a photo of the book standing at an angle, not the cover." },
  // A fifth round.
  { id: 'ol:12739964', reason: "The Decameron (Laurel): a price sticker in the top corner." },
  { id: 'ol:15174483', reason: "Paradise Lost (Norton): a used-book dealer's sticker along the edge." },
  { id: 'ol:6890546', reason: "Il Decameron: the title page of the 1573 Florence printing, not a cover." },
  // A sixth round.
  { id: 'ol:8164676', reason: "The Decameron: a title page with a library's pencil marks, not a cover." },
  { id: 'ol:6276686', reason: "Paradise Lost: a title set on aged brown paper, a wrapper or a title page." },
  // A seventh round.
  { id: 'ol:8235468', reason: "Milton's Paradise Lost, Books I & II: the title page of an 1879 Toronto school edition, not a cover." },
];

const base: MixOptions = { mode: 'mix', size: 2000, seed: 'paperwhite', perBook: PER_BOOK, exclude: EXCLUDED.map(e => e.id) };
const name = poolName(base);
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const contrastOf = new Map(index.covers.map(row => [row[1], row[3]]));

/** A pool grows from itself or from the pool it inherits: its covers are taken first. */
const earlier = existsSync(POOL_FILE) ? (JSON.parse(readFileSync(POOL_FILE, 'utf8')) as { name: string; covers: PoolCover[] }) : null;
const keep = earlier && (earlier.name === name || INHERITS.includes(earlier.name)) ? earlier.covers.map(c => c.id) : [];
const kept = new Set(keep);
const options: MixOptions = { ...base, keep };

interface MeasuresFile {
  measuredAt: string;
  measures: Record<string, CoverMeasure>;
}
const measures: Record<string, CoverMeasure> = existsSync(MEASURES_FILE)
  ? (JSON.parse(readFileSync(MEASURES_FILE, 'utf8')) as MeasuresFile).measures
  : {};
const silent = new Set<string>();
let fetched = 0;

function save() {
  const sorted = Object.fromEntries(Object.entries(measures).sort(([a], [b]) => a.localeCompare(b)));
  const file: MeasuresFile = { measuredAt: new Date().toISOString().slice(0, 10), measures: sorted };
  writeFileSync(MEASURES_FILE, `${JSON.stringify(file)}\n`);
}

/**
 * A cover the pool may add is measured again if its measure has no `blur`
 * yet (taken before 2026-09-26); a kept cover never is.
 */
const measured = (id: string) => id in measures && (kept.has(id) || measures[id].blur !== undefined);

async function bytesOf(id: string, url: string): Promise<Uint8Array | null> {
  const file = IMAGES ? join(IMAGES, `${id.replace(':', '_')}.jpg`) : null;
  if (file && existsSync(file)) return new Uint8Array(readFileSync(file));
  // archive.org answers 503 when asked too fast (2026-09-26: 3024 of 4956 in
  // one run). Back off and ask again rather than leave the cover unmeasured.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 5000 * attempt * attempt));
    fetched++;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'image/*', 'User-Agent': 'beautifulbooks/versus-pool (measuring covers)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) return null;
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (file) writeFileSync(file, bytes);
      return bytes;
    } catch {
      // Try again.
    }
  }
  return null;
}

async function measure(id: string): Promise<void> {
  if (measured(id)) return;
  const url = coverUrlFor(id, 'L');
  if (!url) return;
  try {
    const bytes = await bytesOf(id, url);
    const image = bytes ? decode(bytes) : null;
    if (image) measures[id] = measureCover(image);
    else silent.add(id);
  } catch {
    silent.add(id);
  }
}

/** What `buildPool` asks of a cover: a kept one must fit, an added one must also be crisp. */
const fits = (cover: PoolCover) => fitsGame(measures[cover.id], contrastOf.get(cover.id) ?? 0)
  && (kept.has(cover.id) || crispEnough(measures[cover.id]));

/** Walks one book's covers in the pool's order until `PER_BOOK` fit. */
async function settle(covers: readonly PoolCover[]) {
  let fitting = 0;
  for (const cover of covers) {
    await measure(cover.id);
    if (fits(cover) && ++fitting >= PER_BOOK) return;
  }
}

async function inParallel<T>(items: readonly T[], work: (item: T) => Promise<void>, label: string) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      await work(items[next++]);
      if (++done % 25 === 0) {
        save();
        console.log(`${label}: ${done}/${items.length}, ${fetched} images fetched, ${silent.size} silent`);
      }
    }
  }));
  save();
}

async function main() {
  await inParallel(keep, measure, 'kept covers');
  const books = mixCandidates(index, options);
  await inParallel(books, settle, 'books');

  const covers = buildPool(index, { ...options, measures });
  const out = {
    name,
    builtAt: new Date().toISOString().slice(0, 10),
    indexBuiltAt: index.builtAt,
    inherits: INHERITS,
    perBook: PER_BOOK,
    quality: {
      minHeight: MIN_HEIGHT,
      aspect: [MIN_ASPECT, MAX_ASPECT],
      maxWhite: MAX_WHITE,
      maxBlurOfAdded: MAX_BLUR,
      reclam: { yellow: RECLAM_YELLOW, contrast: RECLAM_CONTRAST },
      plain: 'looksPlain in lib/hotornot/pool.ts',
    },
    excluded: EXCLUDED,
    covers,
  };
  writeFileSync(POOL_FILE, `${JSON.stringify(out, null, 1)}\n`);

  const perWork = new Map<string, number>();
  for (const c of covers) perWork.set(c.workId, (perWork.get(c.workId) ?? 0) + 1);
  const spread = [1, 2, 3, 4, 5].map(k => `${k}: ${[...perWork.values()].filter(n => n === k).length}`).join(', ');
  const stayed = keep.filter(id => covers.some(c => c.id === id)).length;
  const tried = books.flat().filter(c => c.id in measures);
  console.log(`${name}: ${covers.length} covers from ${perWork.size} books (books by covers brought — ${spread})`);
  console.log(`${stayed} of ${keep.length} covers of the earlier pool kept; ${tried.filter(fits).length} of ${tried.length} measured candidates fit; `
    + `${silent.size} did not answer; ${EXCLUDED.length} excluded by hand`);
  if (covers.length < options.size) console.log(`Only ${covers.length} of ${options.size}: too few covers fit.`);
}

main();
