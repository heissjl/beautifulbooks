import Page from '@/app/versus/[pair]/page';

export { generateMetadata } from '@/app/versus/[pair]/page';
export const dynamic = 'force-dynamic';

export default function German({ params }: { params: Promise<{ pair: string }> }) {
  return <Page params={params} locale="de" />;
}
