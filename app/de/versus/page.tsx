import Page from '@/app/versus/page';

export { metadata } from '@/app/versus/page';
export const dynamic = 'force-dynamic';

export default function German() {
  return <Page locale="de" />;
}
