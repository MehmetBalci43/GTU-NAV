# Türkçe Kampüs Yazılı Ticket Eğitim Veri Seti (Birim Sınıflandırma & Aciliyet Analizi)

TRAINING_SAMPLES: list[tuple[str, str, int]] = [
    # 1. Yapı İşleri ve Teknik Daire (Altyapı, Su, Elektrik, Asansör, Isıtma, Yol/Kaldırım)
    ("zemin kat koridorunda su borusu patladı yerler göl oldu çok kaygan", "Yapı İşleri ve Teknik Daire", 94),
    ("tuvalette su sızıntısı var koridora su taşmaya başladı acil tesisatçı lazım", "Yapı İşleri ve Teknik Daire", 88),
    ("asansör arızalandı içinde kalanlar oldu kapısı açılmıyor", "Yapı İşleri ve Teknik Daire", 96),
    ("elektrik panosundan kıvılcım çıkıyor ve yanık kokusu geliyor tehlikeli", "Yapı İşleri ve Teknik Daire", 98),
    ("bina girişindeki yürüyüş yolu aydınlatma direği yanmıyor akşam çok karanlık", "Yapı İşleri ve Teknik Daire", 74),
    ("amfi 1 klima ve havalandırma sistemi çalışmıyor içerisi çok havasız", "Yapı İşleri ve Teknik Daire", 65),
    ("derslik penceresinin camı çatlamış ve rüzgarda kapanmıyor", "Yapı İşleri ve Teknik Daire", 72),
    ("kütüphane önündeki kaldırım taşları çökmüş yürüyüş yolunda su birikiyor", "Yapı İşleri ve Teknik Daire", 70),
    ("kalorifer petekleri su damlatıyor ve sınıf hiç ısınmıyor", "Yapı İşleri ve Teknik Daire", 68),
    ("engelli rampası korkuluğu kırılmış ve geçişte çukur oluşmuş", "Yapı İşleri ve Teknik Daire", 78),
    ("sınıf kapısının kilidi bozuk kapı kapanmıyor", "Yapı İşleri ve Teknik Daire", 55),
    ("amfi sıralarındaki elektrik prizleri yerinden çıkmış açık kablo var", "Yapı İşleri ve Teknik Daire", 85),

    # 2. Bilgi İşlem Dairesi (Projeksiyon, Bilgisayar, İnternet/Eduroam, Ses Sistemi)
    ("amfi 1 projeksiyon cihazı görüntü vermiyor hdmi kablosu bozuk", "Bilgi İşlem Dairesi", 68),
    ("derslikte projeksiyon lambası yanıp sönüyor sunum yapılamıyor", "Bilgi İşlem Dairesi", 64),
    ("yazılım laboratuvarındaki bilgisayarlar açılmıyor ağ bağlantısı yok", "Bilgi İşlem Dairesi", 72),
    ("kütüphane çalışma salonunda eduroam wifi internet bağlantısı sürekli kopuyor", "Bilgi İşlem Dairesi", 60),
    ("büyük amfi mikrofon ve ses sistemi çalışmıyor hocanın sesi duyulmuyor", "Bilgi İşlem Dairesi", 62),
    ("bilgisayar mühendisliği zemin katta eduroam hiç çekmiyor", "Bilgi İşlem Dairesi", 58),
    ("akıllı tahta ve kürsü bilgisayarı açılmıyor ders başlayamıyor", "Bilgi İşlem Dairesi", 70),
    ("amfi 2 projeksiyon perdesi inmiyor ve görüntü bulanık", "Bilgi İşlem Dairesi", 56),

    # 3. İdari ve Mali İşler (Temizlik & Hijyen)
    ("birinci kat erkekler tuvaletinde sabun ve kağıt havlu bitmiş temizlik gerekiyor", "İdari ve Mali İşler (Temizlik)", 52),
    ("amfi sıralarının altı ve koridor çöp kutuları tamamen dolmuş taşmış", "İdari ve Mali İşler (Temizlik)", 48),
    ("lavabo gideri tıkanmış kötü koku yayılıyor hijyen sorunu var", "İdari ve Mali İşler (Temizlik)", 66),
    ("yemekhane girişindeki zemin ıslak ve kirli temizlenmesi gerekiyor", "İdari ve Mali İşler (Temizlik)", 58),
    ("derslik tahtası silinmiyor ve kalemler bitmiş temizlik talebi", "İdari ve Mali İşler (Temizlik)", 42),
    ("kütüphane tuvaletlerinde hijyen malzemesi kalmamış", "İdari ve Mali İşler (Temizlik)", 50),

    # 4. Koruma ve Güvenlik Şube Müdürlüğü
    ("gece kütüphaneden marmaray çıkışına giden yürüyüş yolu çok ıssız güvenlik devriyesi talebi", "Koruma ve Güvenlik Şube Müdürlüğü", 76),
    ("kampüs ana giriş turnikelerinde kart okuyucu çalışmıyor yığılma var", "Koruma ve Güvenlik Şube Müdürlüğü", 72),
    ("yaya yürüyüş yoluna araç park edilmiş yayalar geçemiyor", "Koruma ve Güvenlik Şube Müdürlüğü", 64),
    ("fakülte binası önünde şüpheli sahipsiz çanta bırakılmış kontrol edilmesi rica olunur", "Koruma ve Güvenlik Şube Müdürlüğü", 92),
    ("amfi içinde cüzdan ve öğrenci kimlik kartımı kaybettim güvenlik birimine bilgi", "Koruma ve Güvenlik Şube Müdürlüğü", 45),

    # 5. Öğrenci İşleri ve Kampüs Yaşam (Öneri, Kütüphane, Yemekhane, Ring)
    ("vize ve final sınav haftasında kütüphane çalışma salonlarının kapasitesi artırılsın", "Öğrenci İşleri ve Kampüs Yaşam", 38),
    ("yemekhane öğle saatlerinde çok yoğun oluyor ikinci turnike açılsın önerisi", "Öğrenci İşleri ve Kampüs Yaşam", 35),
    ("marmaray çıkışından fakültelere sabah saatlerinde ek ring seferi konulması talebi", "Öğrenci İşleri ve Kampüs Yaşam", 40),
    ("kampüs içi bisiklet park alanlarının artırılması önerisi", "Öğrenci İşleri ve Kampüs Yaşam", 28),
    ("fakülte kantinine sıcak su sebili ve mikrodalga konulması talebi", "Öğrenci İşleri ve Kampüs Yaşam", 30),

    # 6. Spam / Geçersiz Bildirimler
    ("asdfghjkl qwerty 123456 deneme", "Spam / Geçersiz", 5),
    ("test test 123 deneme mesajı", "Spam / Geçersiz", 5),
    ("ahahahahahaha sjsjsjsj lol", "Spam / Geçersiz", 5),
    ("boş bildirim öylesine yazdım selam", "Spam / Geçersiz", 5),
]
