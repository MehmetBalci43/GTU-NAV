export interface TicketCategoryConfig {
  id: 'technical' | 'infrastructure' | 'cleaning' | 'security' | 'suggestion';
  label: string;
  hint: string;
  defaultDepartment: string;
}

/**
 * İdareye Yazılı Ticket Kategorileri (Katman 2 - Sadece Yazılı, Görsel Yükleme Yok).
 */
export const TICKET_CATEGORIES: TicketCategoryConfig[] = [
  {
    id: 'infrastructure',
    label: 'Yapı / Altyapı / Tesisat Arızası',
    hint: 'Su sızıntısı, elektrik/priz, ısıtma/klima, kapı/cam, asansör veya kaldırım sorunu',
    defaultDepartment: 'Yapı İşleri ve Teknik Daire',
  },
  {
    id: 'technical',
    label: 'Derslik / Amfi Donanım & Bilişim',
    hint: 'Projeksiyon, HDMI kablosu, akıllı tahta, ses sistemi, Eduroam Wi-Fi veya bilgisayar',
    defaultDepartment: 'Bilgi İşlem Dairesi',
  },
  {
    id: 'cleaning',
    label: 'Temizlik & Hijyen Talebi',
    hint: 'Tuvalet/lavabo hijyeni, sabunluk/kağıt eksikliği, derslik veya koridor temizliği',
    defaultDepartment: 'İdari ve Mali İşler (Temizlik)',
  },
  {
    id: 'security',
    label: 'Kampüs Güvenlik & Ulaşım',
    hint: 'Turnike sorunu, hatalı araç parkı, gece aydınlatma/güvenlik veya kayıp eşya',
    defaultDepartment: 'Koruma ve Güvenlik Şube Müdürlüğü',
  },
  {
    id: 'suggestion',
    label: 'Kampüs Yaşam Öneri & Talep',
    hint: 'Kütüphane saatleri, yemekhane, ring seferleri veya kampüs yaşam önerileri',
    defaultDepartment: 'Öğrenci İşleri ve Kampüs Yaşam',
  },
];
