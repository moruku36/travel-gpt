import Head from 'next/head';
import dynamic from 'next/dynamic';

const Booklet = dynamic(() => import('@/components/Booklet'), { ssr: false, loading: () => <p className="boot">読み込み中…</p> });

export default function PrintPage() {
  return (
    <>
      <Head>
        <title>旅のしおり — CoVoyager</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Booklet />
    </>
  );
}
