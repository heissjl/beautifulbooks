import Page from '@/app/c/[id]/edit/page';

export { metadata } from '@/app/c/[id]/edit/page';
export const dynamic = 'force-dynamic';

export default function GermanEditWall(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
