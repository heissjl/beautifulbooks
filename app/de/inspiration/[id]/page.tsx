import Page from '@/app/inspiration/[id]/page';

export { generateMetadata } from '@/app/inspiration/[id]/page';
export const dynamic = 'force-dynamic';

export default function German(props: { params: Promise<{ id: string }> }) {
  return <Page {...props} locale="de" />;
}
