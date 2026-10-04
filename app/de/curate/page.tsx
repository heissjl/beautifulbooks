import Page from '@/app/curate/page';

export { metadata } from '@/app/curate/page';
export const dynamic = 'force-dynamic';

export default function GermanCurate(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
