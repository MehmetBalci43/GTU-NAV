import { useState, useCallback, useRef, useEffect } from 'react';
import { isWithinCampusBounds } from '../services/campusBounds';

export type GpsTrackingStatus =
  | 'idle'
  | 'searching'
  | 'active'
  | 'out_of_campus'
  | 'permission_denied'
  | 'unsupported';

interface UseLiveGeolocationOptions {
  onPositionUpdate?: (lat: number, lon: number, accuracyM: number) => void;
  onNotice?: (message: string) => void;
}

/**
 * Isolated Live Geolocation Hook.
 * Manages navigator.geolocation independently from the core A* routing engine.
 *
 * Guarantees:
 * 1. Off-campus coordinates (common on PC Wi-Fi/ISP geolocation) NEVER leak into the core navigation origin.
 * 2. Geolocation errors/denials NEVER trigger route cancellation or red error banners.
 * 3. 100% opt-in: stays idle until explicitly activated.
 */
export function useLiveGeolocation({ onPositionUpdate, onNotice }: UseLiveGeolocationOptions = {}) {
  const [isLiveGpsActive, setIsLiveGpsActive] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<GpsTrackingStatus>('idle');
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const onNoticeRef = useRef(onNotice);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);

  const stopLiveGps = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsLiveGpsActive(false);
    setGpsStatus('idle');
    setGpsAccuracyMeters(null);
  }, []);

  const startLiveGps = useCallback(() => {
    if (watchIdRef.current !== null) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      onNoticeRef.current?.('Tarayıcınız canlı GPS konum servisini desteklemiyor.');
      return;
    }

    setIsLiveGpsActive(true);
    setGpsStatus('searching');
    onNoticeRef.current?.('📡 Canlı GPS uydularına bağlanılıyor...');

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracyMeters(accuracy || 5);

        // Strict boundary check: Protect campus navigation from off-campus browser geolocation
        if (!isWithinCampusBounds(latitude, longitude)) {
          setGpsStatus('out_of_campus');
          onNoticeRef.current?.(
            '📍 GPS konumunuz GTÜ Kampüsü dışında algılandı. Masaüstü simülasyon modu devrede.'
          );
          // Do NOT feed off-campus coordinates to the campus navigation engine!
          return;
        }

        setGpsStatus('active');
        onPositionUpdateRef.current?.(latitude, longitude, accuracy || 4.0);
      },
      (err) => {
        console.warn('Live GPS watchPosition warning:', err.message);
        setGpsStatus('permission_denied');
        setIsLiveGpsActive(false);
        onNoticeRef.current?.('⚠️ GPS konum izni alınamadı. Simülatörü kullanabilirsiniz.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
  }, []);

  const toggleLiveGps = useCallback(() => {
    if (isLiveGpsActive) {
      stopLiveGps();
      onNoticeRef.current?.('Canlı GPS takibi durduruldu.');
    } else {
      startLiveGps();
    }
  }, [isLiveGpsActive, stopLiveGps, startLiveGps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isLiveGpsActive,
    gpsStatus,
    gpsAccuracyMeters,
    startLiveGps,
    stopLiveGps,
    toggleLiveGps,
  };
}
