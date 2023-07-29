import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import TravelForm from '../components/TravelForm.tsx';

const Home = () => {
  useEffect(() => {
    mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
    new mapboxgl.Map({
      container: 'map', // container id
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.5, 40], // starting position [lng, lat]
      zoom: 9 // starting zoom
    });
  }, []);

  return (
    <div>
      <h1>Travel Planner</h1>
      <TravelForm />
      <div id="map" style={{width: '100%', height: '400px'}}></div>
    </div>
  );
};

export default Home;
