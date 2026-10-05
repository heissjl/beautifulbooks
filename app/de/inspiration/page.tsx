import Page from '@/app/inspiration/page';

export { metadata } from '@/app/inspiration/page';
export const dynamic = 'force-dynamic';

export default function German(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <Page {...props} locale="de" />;
}
