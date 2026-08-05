export default defineEventHandler(async () => {
  // Major amusement parks worldwide with coordinates
  const parks = [
    // France
    { name: 'Disneyland Paris', country: 'France', lat: 48.872, lng: 2.776 },
    { name: 'Parc Astérix', country: 'France', lat: 49.135, lng: 2.572 },
    { name: 'Futuroscope', country: 'France', lat: 46.669, lng: 0.368 },
    { name: 'Puy du Fou', country: 'France', lat: 46.893, lng: -0.932 },
    { name: 'Vulcania', country: 'France', lat: 45.813, lng: 2.940 },
    // USA
    { name: 'Disney World Magic Kingdom', country: 'États-Unis', lat: 28.417, lng: -81.581 },
    { name: 'Universal Studios Hollywood', country: 'États-Unis', lat: 34.138, lng: -118.353 },
    { name: 'Six Flags Magic Mountain', country: 'États-Unis', lat: 34.424, lng: -118.597 },
    { name: 'Cedar Point', country: 'États-Unis', lat: 41.480, lng: -82.683 },
    { name: 'Hersheypark', country: 'États-Unis', lat: 40.288, lng: -76.656 },
    { name: 'Disneyland California', country: 'États-Unis', lat: 33.812, lng: -117.919 },
    // Japan
    { name: 'Tokyo Disneyland', country: 'Japon', lat: 35.633, lng: 139.880 },
    { name: 'Universal Studios Japan', country: 'Japon', lat: 34.665, lng: 135.432 },
    { name: 'Fuji-Q Highland', country: 'Japon', lat: 35.488, lng: 138.780 },
    // Germany
    { name: 'Europa-Park', country: 'Allemagne', lat: 48.268, lng: 7.722 },
    { name: 'Phantasialand', country: 'Allemagne', lat: 50.800, lng: 6.881 },
    { name: 'Heide Park', country: 'Allemagne', lat: 53.024, lng: 9.878 },
    { name: 'Legoland Deutschland', country: 'Allemagne', lat: 48.426, lng: 10.299 },
    // Spain
    { name: 'PortAventura', country: 'Espagne', lat: 41.088, lng: 1.157 },
    { name: 'Parque Warner Madrid', country: 'Espagne', lat: 40.230, lng: -3.593 },
    { name: 'Siam Park', country: 'Espagne', lat: 28.069, lng: -16.727 },
    // Italy
    { name: 'Gardaland', country: 'Italie', lat: 45.456, lng: 10.710 },
    { name: 'Mirabilandia', country: 'Italie', lat: 44.338, lng: 12.264 },
    // UK
    { name: 'Alton Towers', country: 'Royaume-Uni', lat: 52.987, lng: -1.889 },
    { name: 'Thorpe Park', country: 'Royaume-Uni', lat: 51.404, lng: -0.513 },
    { name: 'Legoland Windsor', country: 'Royaume-Uni', lat: 51.464, lng: -0.651 },
    // Netherlands
    { name: 'Efteling', country: 'Pays-Bas', lat: 51.650, lng: 5.048 },
    { name: 'Walibi Holland', country: 'Pays-Bas', lat: 52.442, lng: 5.762 },
    // Denmark
    { name: 'Tivoli Gardens', country: 'Danemark', lat: 55.674, lng: 12.568 },
    { name: 'Legoland Billund', country: 'Danemark', lat: 55.736, lng: 9.128 },
    // Sweden
    { name: 'Liseberg', country: 'Suède', lat: 57.695, lng: 11.990 },
    { name: 'Gröna Lund', country: 'Suède', lat: 59.323, lng: 18.097 },
    // UAE
    { name: 'Ferrari World Abu Dhabi', country: 'Émirats A. U.', lat: 24.484, lng: 54.607 },
    { name: 'IMG Worlds of Adventure', country: 'Émirats A. U.', lat: 25.045, lng: 55.388 },
    { name: 'Motiongate Dubai', country: 'Émirats A. U.', lat: 24.922, lng: 55.011 },
    // China
    { name: 'Shanghai Disneyland', country: 'Chine', lat: 31.144, lng: 121.657 },
    { name: 'Ocean Park Hong Kong', country: 'Chine', lat: 22.247, lng: 114.175 },
    // South Korea
    { name: 'Everland', country: 'Corée du Sud', lat: 37.294, lng: 127.203 },
    { name: 'Lotte World', country: 'Corée du Sud', lat: 37.511, lng: 127.098 },
    // Singapore
    { name: 'Universal Studios Singapore', country: 'Singapour', lat: 1.254, lng: 103.824 },
    // Canada
    { name: 'Canada Wonderland', country: 'Canada', lat: 43.843, lng: -79.542 },
    { name: 'La Ronde', country: 'Canada', lat: 45.523, lng: -73.535 },
    // Australia
    { name: 'Movie World', country: 'Australie', lat: -27.908, lng: 153.312 },
    { name: 'Dreamworld', country: 'Australie', lat: -27.864, lng: 153.315 },
    // Belgium
    { name: 'Walibi Belgium', country: 'Belgique', lat: 50.699, lng: 4.591 },
    { name: 'Plopsaland', country: 'Belgique', lat: 51.080, lng: 2.597 },
    // Austria
    { name: 'Prater Vienne', country: 'Autriche', lat: 48.216, lng: 16.399 },
    // Finland
    { name: 'Linnanmäki', country: 'Finlande', lat: 60.188, lng: 24.940 },
    { name: 'Moomin World', country: 'Finlande', lat: 60.474, lng: 22.005 },
    // Brazil
    { name: 'Beto Carrero World', country: 'Brésil', lat: -26.806, lng: -48.614 },
    // South Africa
    { name: 'Gold Reef City', country: 'Afrique du Sud', lat: -26.235, lng: 28.012 },
    // Mexico
    { name: 'Six Flags México', country: 'Mexique', lat: 19.295, lng: -99.209 },
    { name: 'Xcaret', country: 'Mexique', lat: 20.579, lng: -87.119 },
    // Poland
    { name: 'Energylandia', country: 'Pologne', lat: 50.002, lng: 19.410 },
  ]

  return parks
})
