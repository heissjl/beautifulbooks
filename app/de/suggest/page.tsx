import Page from '@/app/suggest/page';

export { metadata } from '@/app/suggest/page';
export const dynamic = 'force-dynamic';

export default function GermanSuggest() {
  return <Page locale="de" />;
}
