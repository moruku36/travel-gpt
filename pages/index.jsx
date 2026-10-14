import React, { useEffect } from 'react';
import Head from 'next/head';
import mapboxgl from 'mapbox-gl';
import Chat from '../components/Chat';
import TravelForm from '../components/TravelForm';

const Home = () => {
  useEffect(() => {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    new mapboxgl.Map({
      container: 'map', // container id
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [0, 0], // changed to center of the earth
      zoom: 1 // changed to show the whole world
    });
  }, []);

  const handleFormSubmit = (message) => {
    // You will need to implement the logic to pass this message to the Chat component
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <Head>
        <title>CoVoyager Travel Chat</title>
      </Head>
      <div style={{ width: '25%', height: '100%', overflowY: 'auto' }}>
        <h1>CoVoyager Travel Chat</h1>
        <div style={{ margin: '8px 12px', padding: '8px 10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px' }}>
          <span style={{ fontWeight: 'bold', color: '#1d4ed8' }}>固定データプレビュー:</span>{' '}
          <a href="/mock" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>
            Phase 1 画面モック (/mock) を開く &rarr;
          </a>
        </div>
        <TravelForm onFormSubmit={handleFormSubmit} />
        <Chat />
      </div>
      <div style={{ width: '75%', height: '100%' }}>
        <div id="map" style={{ width: '100%', height: '100%' }}></div>
      </div>
    </div>
  );
};

export default Home;
