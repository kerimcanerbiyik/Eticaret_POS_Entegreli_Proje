const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MONGODB ATLAS BAĞLANTISI
// const MONGO_URI = 'mongodb+srv://KULLANICI_ADINIZ:SIFRENIZ@cluster_adi.mongodb.net/veritabani_adi?retryWrites=true&w=majority';
const MONGO_URI = 'mongodb+srv://kerimcan:kerim.KE4@cluster0.bhwtbps.mongodb.net/trendmagaza?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log("E-Ticaret & POS Birleşik Veritabanı Bağlantısı Başarılı!"))
    .catch(err => console.error("Bağlantı hatası:", err));


// ==========================================
// 1. MODEL KATMANI
// ==========================================
const UrunModel = mongoose.model('Urun', new mongoose.Schema({
    baslik: String,
    fiyat: Number,
    kategori: String,
    stok: Number,
    saticiAdi: String,
    tarih: { type: Date, default: Date.now }
}));

const SiparisModel = mongoose.model('Siparis', new mongoose.Schema({
    musteriAdi: String,
    urunler: Array,
    toplamTutar: Number,
    odemeDurumu: { type: String, default: 'Onaylandı' },
    siparisTarihi: { type: Date, default: Date.now }
}));


// ==========================================
// 2. SERVICE KATMANI (İş Mantığı & POS Ödeme Servisi)
// ==========================================
class TicaretService {
    async urunleriGetir() {
        return await UrunModel.find().sort({ tarih: -1 });
    }

    async urunEkle(veri) {
        return await new UrunModel(veri).save();
    }

    // POS Ödeme / Iyzico Simülasyonu
    async posOdemeYap(odemeBilgileri) {
        const { kartNumarasi, tutar } = odemeBilgileri;
        if (!kartNumarasi || kartNumarasi.length < 12) {
            throw new Error("Geçersiz kredi kartı numarası!");
        }
        return { posIslemId: 'POS-' + Math.floor(Math.random() * 900000 + 100000), tutar };
    }

    async siparisOlustur(veri) {
        const posSonuc = await this.posOdemeYap({
            kartNumarasi: veri.kartNumarasi,
            tutar: veri.toplamTutar
        });

        const yeniSiparis = new SiparisModel({
            musteriAdi: veri.musteriAdi,
            urunler: veri.urunler,
            toplamTutar: veri.toplamTutar,
            odemeDurumu: `Ödendi (${posSonuc.posIslemId})`
        });
        return await yeniSiparis.save();
    }
}

const ticaretService = new TicaretService();


// ==========================================
// 3. CONTROLLER KATMANI (Rotalar -> Doğrudan Service Yapışması)
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/urunler', async (req, res) => {
    try {
        res.json({ success: true, data: await ticaretService.urunleriGetir() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/urun-ekle', async (req, res) => {
    try {
        res.json({ success: true, message: "Ürün başarıyla eklendi!", data: await ticaretService.urunEkle(req.body) });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/siparis-ver', async (req, res) => {
    try {
        const sonuc = await ticaretService.siparisOlustur(req.body);
        res.json({ success: true, message: "POS Ödemesi Alındı & Sipariş Tamamlandı!", siparisId: sonuc._id });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Birleşik E-Ticaret + POS Sunucusu ${PORT} portunda ayakta 🚀`);
});
