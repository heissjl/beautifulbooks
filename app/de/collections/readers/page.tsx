import Page from '@/app/collections/readers/page';

export { metadata } from '@/app/collections/readers/page';
export const dynamic = 'force-dynamic';

export default function GermanReaders(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
