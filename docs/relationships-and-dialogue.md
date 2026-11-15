# Kişiler, ilişkiler ve diyalog

Yerleşimdeki yedi sakin için kişilik ve konuşma verileri `src/systems/DialogueSystem.ts` içinde çizim kodundan ayrı tutulur. Kişilik ölçekleri 0–100 aralığındadır; cesaret, sabır, cömertlik ve müzakere seçeneklerin kullanılabilirliğini değiştirir. Tüccarın temkinliliği pazardan erken ayrılmasını, sabırlı ve cömert kişilerin ise sosyal karşılaşmalarda daha hızlı yakınlaşmasını etkiler.

İlişkiler tek bir puana indirgenmez. Her karakter için aile, arkadaş, askerî, yerel otorite, tüccar, rakip ve siyasi hizip alanları ayrı kaydedilir. Diyalog kararları, görevler, güven ve kalıcı bayraklar `SettlementSaveState.dialogue` altında saklanır; yeni kuşak seçimi bu durumu sıfırlamaz.

Hasan’a tohum yardımı gelecek kuşaklara uzanan bir destek bağı açar. Yusuf’a verilen kervan refakati sözü, tutulduğu takdirde tüccar ilişkisini ve kervan görevini etkiler. Sınır anlaşmazlığında İlyas’a arabuluculuk başvurusu, yerel otorite ilişkisini değiştirir ve kurgusal bir tarihçe olayı kaydeder. Emine, Fatma ve Kara’nın da kendilerine özgü dalları ve sonuçları vardır.

Türkçe başlangıç dilidir. İngilizce karşılığı bulunmayan metin Türkçeye döner. Yerleşim sakinleri, kişisel geçmişleri, konuşmaları ve yerel olaylar oyun için oluşturulmuş kurmacadır; belgelenmiş tarihsel kişi veya rutin iddiası taşımaz.
