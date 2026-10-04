import Page from '@/app/c/[id]/page';

export { generateMetadata } from '@/app/c/[id]/page';
export const dynamic = 'force-dynamic';

export default function GermanWall(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
