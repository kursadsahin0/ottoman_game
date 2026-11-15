# Tarihsel içerik araştırma ve doğrulama iş akışı

## Kaynak standardı

İçerik için önce hakemli akademik yayınlara, akademik yayınevlerinin kitap ve bölümlerine, müze/üniversite/arsiv kataloglarına ve güvenilir ansiklopedilere bakın. Bir kaynak künyesi, metin kontrol edilmeden bir iddianın kanıtı sayılmaz. Kaynak kayıtlarında yazar, başlık, yayın, tarih, sayfa veya katalog referansı, kalıcı bağlantı, kontrol tarihi ve kaynağın desteklediği tam iddia bulunmalıdır. Sayfa metnine erişilemediyse bunu not edin; sayfa numarası veya kaynak desteği uydurmayın.

Başlangıç paketi `/src/data/HistoricalContent.ts` içinde tutulur. Kaynaklar tek bir kayıt havuzuna (`HISTORICAL_SOURCES`), olaylar ise ayrı kayıtlara yazılır. `supports` alanı her olay-kaynak ilişkisinde, kaynağın hangi ifadeyi desteklediğini açıkça söyler. Kaynağın gösterdiğinden daha kesin tarih, kişi, yer veya nedensellik eklenmemelidir.

## İçerik sınıfları

- `documented_fact`: başvurulan kaynağın açıkça desteklediği çekirdek iddia. Bu etiket “tartışmasız” anlamına gelmez.
- `plausible_unverified`: döneme uyabilecek ancak bu paket içinde doğrulanmamış ayrıntı. Kaynaklı olay gibi sunulamaz.
- `disputed_interpretation`: kaynaklar veya tarih yazımı arasında anlamlı belirsizlik/tartışma bulunan yorum. Rakip yorumlar ve tarih aralığı kaydedilir.
- `fictional`: oyun için yazılmış kişi/yer/olay. Tarihsel kaynakla meşrulaştırılmaz.
- `alternate_history`: oyuncu veya simülasyonun tarihsel temelden ayrılan sonucu. Temel kaydı değiştirmez; ayrı bir ayrışma gerektirir.

## Olay şeması ve tarih belirsizliği

Her olay kaydı kimlik, ad, yıl aralığı, tarih etiketi ve hassasiyeti, kişiler, yerler, bağlam, sınıf, güven düzeyi, kaynak desteği, tartışmalı yorumlar, izin verilen oyun uyarlamaları ve önkoşullar taşır. Sadece kaynak açıkça destekliyorsa gün/ay kullanın. `terminus_ante_quem` kesin olay tarihi değil üst sınırdır; `circa` ve `year_range` ekranda belirsizliği korur. Biyografik sınırlar bilinmiyorsa tahmin ederek doldurmayın.

## İçerik ekleme adımları

1. İddiayı daraltın ve birincil kayıt, akademik çalışma veya güvenilir başvuru kaynağı arayın.
2. Kaynağı açıp ilgili sayfa/başlık/özet bölümünü kontrol edin. Yalnızca erişilen bölümün desteklediği ifadeyi yazın.
3. Kaynak ve olay kayıtlarını ayrı ekleyin; sınıfı, güveni ve tarihin hassasiyetini seçin.
4. Belirsizliği, rakip yorumu, oyun uyarlaması sınırını ve tarihsel temelden ayrışma kuralını kaydedin.
5. `npm run test:chronology` ve `npm run typecheck` çalıştırın. Bilerek açık bırakılmış tarihsel soruları “doğrulanmamış” olarak bırakın; testleri geçsin diye kesinleştirmeyin.
6. Büyük içerik eklemelerini başka bir editörün kaynak metnini ve iddia eşleşmesini gözden geçirmesinden sonra yayımlayın.

## İlk paket kaynak kapsamı ve açık noktalar

- Douglas A. Howard, *A History of the Ottoman Empire*, “Ottoman Genesis, 1300–1397”, Cambridge University Press (2017), pp. 8–11: Osman’ın biyografisinin az bilindiğini, doğumunun bilinmediğini, kuruluş anlatılarının geç kaynaklara dayandığını, ölümünün muhtemelen 1324’e kadar olduğunu ve Bursa’nın 1326’da alındığını bildirir.
- Albert Failler, “Les origines de l’Empire ottoman et la bataille de Bapheus (1302)”, *Revue des études byzantines* 77 (2019), pp. 175–202; TDV İslâm Ansiklopedisi “Pachymeres, Georgios”: Bapheus için 1302 yılı verilse de anlatıların kronolojisi ve Sangarios taşkınıyla ilişki dikkatle ele alınmalıdır. Bu paket yılı kullanır, kesin gün atamaz ve Koyunhisar özdeşliğini doğrulanmış saymaz.
- Jerzy Hauziński, “The Connections of the Ottomans state crisis with the neighbouring vassal states (1403–1413). Rumelian course”, *Balcanica Posnaniensia* 21 (2014), pp. 13–24: makale özeti Ankara Savaşı’nı 28 Temmuz 1402, Fetret’in sonunu 1413 olarak verir.
- Rudi Paul Lindner, “Anatolia, 1300–1451”, *The Cambridge History of Turkey*, vol. 1, böl. 4: bu pakette yalnızca bölgesel akademik çerçeveyi destekler; belirli kuruluş günü iddiasında kullanılmaz.

Bu küçük paket her yılı doldurmaz. Orhan’ın tahta geçişinin kesin yılı, erken hükümdarların ayrıntılı saltanat aralıkları, Osman’ın kesin ölüm yılı ve Bapheus/Koyunhisar özdeşliği bu içerik geçişinde tam olarak doğrulanmış sayılmaz. Oyun simülasyonunda gereken tarihler, tarih yazımı iddiasından ayrı tutulmalıdır.
