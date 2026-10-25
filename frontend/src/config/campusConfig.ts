export const CAMPUS_CONFIG = {
  name: 'Gebze Teknik Üniversitesi (GTÜ) Çayırova Yerleşkesi',
  defaultCenter: [29.3592, 40.8082] as [number, number],
  defaultZoom: 15.8,
  defaultPitch: 42,
  defaultBearing: -12,
  maxBounds: [
    [29.346, 40.801],
    [29.371, 40.818],
  ] as [[number, number], [number, number]],
  defaultSimStartCoord: {
    lat: 40.807664,
    lon: 29.363771,
    label: 'GTÜ - Fatih Marmaray İstasyonu Çıkışı',
  },
  snapThresholdMeters: 15.0,
  offRouteThresholdMeters: 18.0,
  buildingCategoryColors: {
    academic: '#3b82f6',
    library: '#8b5cf6',
    dining: '#f59e0b',
    admin: '#0ea5e9',
    transit: '#10b981',
  } as Record<string, string>,
};
