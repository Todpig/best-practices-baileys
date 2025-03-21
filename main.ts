import { SessionService } from "./src/services/SessionService";

(async function main() {
  const service = new SessionService();
  const result = await service.createSession({ sessionId: "teste" });
  await service.sendText(
    "teste",
    {
      text: "vambora!!‼️\n📦 Frete Grátis Amazon Prime\n🔥 R$ 22,45 À vista no Pix e boleto\n❤️ REAGE AQUI SE VOCÊ GOSTOU!\\\\n🛒 https://pechinchou.com.br/oferta/59318",
      linkPreview: {
        "canonical-url": "https://pechinchou.com.br/oferta/59318",
        "matched-text": "https://pechinchou.com.br/oferta/59318",
        title: "📦 Frete Grátis Amazon Prime",
        description: "🔥 R$ 22,45 À vista no Pix e boleto",
      },
    },
    ["558496783580@s.whatsapp.net"]
  );
})();
