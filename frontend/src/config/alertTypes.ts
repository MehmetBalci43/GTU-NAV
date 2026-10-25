export interface AlertTypeConfig {
  id: 'road_work' | 'puddle_ice' | 'lighting_fault' | 'event_stand';
  title: string;
  subtitle: string;
  badgeColor: string;
  hexColor: string;
  blocksRoute: boolean;
}

/**
 * Genişletilebilir Harita Uyarı Şablonları (Katman 1).
 * Yeni bir harita uyarı tipi eklemek için bu diziye 1 obje eklemek yeterlidir.
 */
export const ALERT_TYPES: AlertTypeConfig[] = [
  {
    id: 'road_work',
    title: 'Yol Çalışması / Kapalı Geçit',
    subtitle: 'Kazı veya çalışma var — Yaya rotası bu yoldan kaçınır',
    badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
    hexColor: '#ef4444',
    blocksRoute: true,
  },
  {
    id: 'puddle_ice',
    title: 'Su Birikintisi / Kaygan Yol',
    subtitle: 'Yağış sonrası su birikintisi veya kaygan zemin uyarısı',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    hexColor: '#f59e0b',
    blocksRoute: false,
  },
  {
    id: 'lighting_fault',
    title: 'Aydınlatma Arızası / Karanlık Yol',
    subtitle: 'Yürüyüş yolu lambası yanmıyor, gece görüş düşük',
    badgeColor: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    hexColor: '#eab308',
    blocksRoute: false,
  },
  {
    id: 'event_stand',
    title: 'Kampüs Etkinliği / Topluluk Standı',
    subtitle: 'Öğrenci kulübü standı, tanıtım veya açık hava etkinliği',
    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    hexColor: '#10b981',
    blocksRoute: false,
  },
];
