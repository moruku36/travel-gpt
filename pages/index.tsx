import Head from 'next/head';
import dynamic from 'next/dynamic';

// The planner reads localStorage and WebGL, so it renders on the client only.
const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => <div className="boot">CoVoyager を準備中…</div>,
});

export default function Home() {
  return (
    <>
      <Head>
        <title>CoVoyager Travel Chat</title>
        <meta name="description" content="地図とチャットで、ふたりの旅を一緒に決める旅行プランナー" />
      </Head>
      <App />
    </>
  );
}
