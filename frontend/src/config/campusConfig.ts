export const CAMPUS_CONFIG = {
  name: 'Gebze Teknik Üniversitesi (GTÜ) Çayırova Yerleşkesi',
  // Exact geometric center of all 24 GTÜ campus buildings
  defaultCenter: [29.3602, 40.8092] as [number, number],
  defaultZoom: 15.45,
  defaultPitch: 40,
  defaultBearing: -10,
  // Exact bounding box of all GTÜ buildings & walkways for fitBounds
  campusBounds: [
    [29.3548, 40.8050],
    [29.3656, 40.8145],
  ] as [[number, number], [number, number]],
  maxBounds: [
    [29.342, 40.798],
    [29.376, 40.822],
  ] as [[number, number], [number, number]],
  defaultSimStartCoord: {
    lat: 40.807664,
    lon: 29.363771,
    label: 'GTÜ - Fatih Marmaray İstasyonu Çıkışı',
  },
  snapThresholdMeters: 6.0,
  offRouteThresholdMeters: 12.0,
  buildingCategoryColors: {
    academic: '#3b82f6',
    library: '#8b5cf6',
    dining: '#f59e0b',
    admin: '#0ea5e9',
    transit: '#10b981',
  } as Record<string, string>,
};
