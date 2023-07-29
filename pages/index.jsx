import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import TravelForm from '../components/TravelForm';

const Home = () => {
  useEffect(() => {
    //mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    mapboxgl.accessToken = '<sk.eyJ1Ijoia2VudGFyb21vcmkiLCJhIjoiY2xrbnE0ejI2MXk1YjNvcnp6Y3ZrMm9laiJ9.T744HGsNP8nByV7xFkmjzA>';
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
