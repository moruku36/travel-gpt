import React, { useEffect } from 'react';
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
      <div style={{ width: '25%', height: '100%', overflowY: 'auto' }}>
        <h1>Travel Planner</h1>
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
