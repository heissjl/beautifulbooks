import Page from '@/app/shelfportrait/[id]/page';

export { generateMetadata } from '@/app/shelfportrait/[id]/page';
export const dynamic = 'force-dynamic';

export default function German(props: { params: Promise<{ id: string }> }) {
  return <Page {...props} locale="de" />;
}
