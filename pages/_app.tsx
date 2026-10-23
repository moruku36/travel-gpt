import type { AppProps } from 'next/app';
import Head from 'next/head';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/globals.css';

export default function CoVoyagerApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b7285" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
