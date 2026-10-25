export const MARMARAY_SCHEDULE_CONFIG = {
  stationName: 'GTÜ - Fatih Marmaray İstasyonu',
  stationBuildingId: 'mar',
  stationCoords: {
    lat: 40.807664,
    lon: 29.363771,
  },
  firstTrainHour: 6,
  lastTrainHour: 23,
  /** Halkalı (İstanbul) yönü her saat başı hangi dakikalarda kalkar (15 dk periyot) */
  halkaliMinutesPastHour: [4, 19, 34, 49],
  /** Gebze / Kocaeli yönü her saat başı hangi dakikalarda kalkar (15 dk periyot) */
  gebzeMinutesPastHour: [11, 26, 41, 56],
};
