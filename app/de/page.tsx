import Home from '@/app/page';

export { generateMetadata } from '@/app/page';

export default function GermanHome(props: Parameters<typeof Home>[0]) {
  return <Home {...props} locale="de" />;
}
