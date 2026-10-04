import Page from '@/app/collections/page';

export { metadata } from '@/app/collections/page';
export const dynamic = 'force-dynamic';

export default function GermanCollections(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
