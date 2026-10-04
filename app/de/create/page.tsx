import Page from '@/app/create/page';

export { metadata } from '@/app/create/page';
export const dynamic = 'force-dynamic';

export default function GermanCreate() {
  return <Page locale="de" />;
}
