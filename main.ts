import { SessionService } from "./src/services/SessionService";

(async function main() {
  const service = new SessionService();
  const result = await service.createSession({ sessionId: "teste" });
  await service.sendText(
    "teste",
    {
      text: "Teste",
    },
    ["558899999999@s.whatsapp.net"]
  );
})();
