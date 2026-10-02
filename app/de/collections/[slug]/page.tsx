import Page from '@/app/collections/[slug]/page';

export { generateMetadata } from '@/app/collections/[slug]/page';
export const dynamic = 'force-dynamic';

export default function GermanCollection(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
