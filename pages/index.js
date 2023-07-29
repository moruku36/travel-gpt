import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = process.env.sk.eyJ1Ijoia2VudGFyb21vcmkiLCJhIjoiY2xrbnE0ejI2MXk1YjNvcnp6Y3ZrMm9laiJ9.T744HGsNP8nByV7xFkmjzA;
const map = new mapboxgl.Map({
  container: 'map', // container id
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [-74.5, 40], // starting position [lng, lat]
  zoom: 9 // starting zoom
});
