import Page from '@/app/create/review/page';

export { metadata } from '@/app/create/review/page';
export const dynamic = 'force-dynamic';

export default function GermanReview() {
  return <Page locale="de" />;
}
