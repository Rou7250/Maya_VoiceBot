# Kapture Finance — Maya Voice AI Collections Agent

**Maya** is an outbound Voice AI collections agent that authenticates a customer before ever discussing their debt, then handles Promise-to-Pay, disputes, hardship, DNC, and other collections scenarios — with every action logged as an auditable tool call.

## 1. Overview
Automated voice agent for loan-payment collection calls, built on Vapi + GPT-4o + Deepgram + ElevenLabs/Cartesia, backed by a mock Node.js webhook server.

## 2. Business Problem
Manual collections calling is expensive and inconsistent. Maya automates first-line outreach while enforcing a hard compliance rule: **no debt information before identity verification**.

## 3. Features
- Identity verification gate before any debt disclosure
- Promise-to-Pay capture + mock payment link (SMS/WhatsApp)
- Already-paid, hardship, dispute, wrong-person, DNC, silence, and abusive-caller handling
- Human escalation for hardship/dispute
- Full call disposition logging
- English / Hindi / Hinglish language switching mid-call
- Conversation state preserved across turns and languages

## 4. Architecture
```
Customer → Telephony/SIP → Vapi → Deepgram STT → GPT-4o → Tool calls → Mock Webhook Server
                                                      ↓
                                             ElevenLabs/Cartesia TTS → Customer
```
Full diagrams: `docs/HLD_Document.md`.

## 5. Technology Stack
Vapi.ai · OpenAI GPT-4o/GPT-4o-mini (temp 0.1) · Deepgram Nova-2 · ElevenLabs/Cartesia · Node.js 18+/Express · ngrok/Render/Vercel

## 6. Project Structure
```
kapture-collections-voicebot/
├── README.md
├── docs/HLD_Document.md
├── vapi/system_prompt.txt, tool_definitions.json
├── mock-server/package.json, server.js, .env.example
└── tests/test_cases.json
```

## 7. Setup Instructions
```bash
git clone <repo-url>
cd kapture-collections-voicebot/mock-server
npm install
cp .env.example .env
npm start
```
Server runs on `http://localhost:3000`.

## 8. Environment Variables
See `mock-server/.env.example` — port, demo account fields, mock verification codes (`1234`, `1995`), optional webhook secret.

## 9. Backend Setup
`node server.js` starts an Express server exposing:
- `POST /webhook` — main Vapi tool-call endpoint
- `GET /health` — health check
- `GET /dispositions`, `GET /ptps` — in-memory logs for demo inspection

## 10. Vapi Setup
1. Create an assistant named **Maya**.
2. Paste `vapi/system_prompt.txt` as the system prompt.
3. Transcriber: Deepgram nova-2 (en-US, multilingual enabled).
4. Model: GPT-4o or GPT-4o-mini, temperature `0.1`.
5. Voice: ElevenLabs/Cartesia, professional female voice.
6. First message: *"Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?"*
7. Import `vapi/tool_definitions.json` as the assistant's tools, pointing each `server.url` to your public webhook URL.

## 11. ngrok/Render Deployment
Local: `ngrok http 3000`, then use the printed `https://...ngrok-free.app/webhook` URL in the Vapi tool config.
Alternatively deploy `mock-server/` to Render or Vercel and use that URL.

## 12. Tool Descriptions
`verify_customer`, `log_promise_to_pay`, `send_payment_link`, `escalate_to_agent`, `mark_disposition` — see `docs/HLD_Document.md` §4 for schemas.

## 13. Conversation Flows
Greeting → identity confirmation → verification → (only if verified) debt disclosure → intent handling (PTP / already paid / hardship / dispute / DNC / wrong person / silence) → disposition → call ends. Full flow: `docs/HLD_Document.md` §2, §7.

## 14. Compliance Rules
- No debt disclosure pre-authentication (hard rule)
- Calls only 08:00–19:00 local time
- Immediate DNC honoring
- PII masked in logs
- No unauthorized waivers > 10%
- Professional, non-argumentative tone at all times

## 15. Testing Instructions
Test scripts: `tests/test_cases.json` (10 cases, TC-001–TC-010). Run manually against the Vapi assistant, or hit `mock-server`'s `/webhook` directly with sample tool-call payloads (see examples in `docs/HLD_Document.md`).

## 16. Bugs / Debugging Notes
- Server logs every tool call with masked PII to stdout.
- `GET /dispositions` and `GET /ptps` let you inspect state without a live call.
- If Vapi can't reach the webhook, re-check the ngrok URL — it changes on every restart unless you have a reserved domain.

## 17. Future Enhancements
- Persistent DB instead of in-memory store
- Real payment gateway integration
- Real SMS/WhatsApp delivery
- Automated calling-window enforcement
- Sentiment-based abuse detection

## 18. Demo Instructions
Record 2–4 min covering: (1) Happy path — greeting → auth → debt disclosure → PTP → payment link → disposition; (2) One edge case (Already Paid / Dispute / DNC), visibly showing tool calls and the authentication guardrail blocking early debt disclosure.
