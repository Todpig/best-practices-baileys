import { SessionService } from "./src/services/SessionService";

(async function main() {
  const service = new SessionService();
  const result =  await service.createSession({ sessionId: "teste" });
  console.log(result);
})();
