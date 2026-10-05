import Page from '@/app/shelfportrait/page';

export { metadata } from '@/app/shelfportrait/page';
export const dynamic = 'force-dynamic';

export default function German(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Page {...props} locale="de" />;
}
