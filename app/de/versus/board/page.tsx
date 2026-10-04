import Page from '@/app/versus/board/page';

export { metadata } from '@/app/versus/board/page';
export const dynamic = 'force-dynamic';

export default function German(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
