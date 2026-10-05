import Page from '@/app/shelfportrait/board/page';

export { generateMetadata } from '@/app/shelfportrait/board/page';
export const dynamic = 'force-dynamic';

export default function German(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Page {...props} locale="de" />;
}
