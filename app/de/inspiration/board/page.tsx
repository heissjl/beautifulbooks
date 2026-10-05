import Page from '@/app/inspiration/board/page';

export { generateMetadata } from '@/app/inspiration/board/page';
export const dynamic = 'force-dynamic';

export default function German(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Page {...props} locale="de" />;
}
