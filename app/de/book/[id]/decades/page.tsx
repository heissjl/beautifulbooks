import Page from '@/app/book/[id]/decades/page';

export { generateMetadata, generateStaticParams } from '@/app/book/[id]/decades/page';
export const revalidate = 86400;

export default function GermanDecades(props: Parameters<typeof Page>[0]) {
  return <Page {...props} locale="de" />;
}
