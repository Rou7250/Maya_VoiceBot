/**
 * Kapture Finance — Maya Voice AI Collections Agent
 * Mock Webhook Server
 *
 * Implements the 5 tools Vapi calls during a Maya call:
 *   verify_customer, log_promise_to_pay, send_payment_link,
 *   escalate_to_agent, mark_disposition
 *
 * This is a MOCK backend for demonstration only — no real payments,
 * no real SMS/WhatsApp sends, in-memory storage only.
 */

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');

const app = express();
app.use(express.json());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 3000;
const VALID_CODES = (process.env.MOCK_VALID_CODES || '1234,1995')
  .split(',')
  .map((c) => c.trim());

const DEMO_ACCOUNT = {
  account_id: process.env.DEMO_ACCOUNT_ID || 'ACC-88392',
  customer_name: process.env.DEMO_CUSTOMER_NAME || 'Rahul Sharma',
  loan_type: process.env.DEMO_LOAN_TYPE || 'Personal Loan',
  overdue_amount: Number(process.env.DEMO_OVERDUE_AMOUNT || 8499),
  days_past_due: Number(process.env.DEMO_DAYS_PAST_DUE || 12),
};

// In-memory stores (reset on restart) — fine for a demo/mock backend
const ptpStore = [];
const dispositionStore = [];
let ptpCounter = 1000;

// ---- helpers -------------------------------------------------------------

/** Mask a name for PII-safe logging, e.g. "Rahul Sharma" -> "Rahul S****" */
function maskName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ? parts[0][0] + '****' : '****';
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0]}****`;
}

function logToolCall(name, args, result) {
  console.log(
    `[TOOL] ${name} | args=${JSON.stringify(args)} | ` +
      `result=${JSON.stringify(result)} | account=${maskName(DEMO_ACCOUNT.customer_name)}`
  );
}

/** Build the Vapi-expected tool-call response envelope */
function vapiResult(toolCallId, resultObj) {
  return {
    results: [
      {
        toolCallId,
        result: JSON.stringify(resultObj),
      },
    ],
  };
}

// ---- tool implementations -------------------------------------------------

function verify_customer(args) {
  const account_id = args.account_id || args.accountId || args['Account Id'] || args['account id'] || '';
  const verification_code = args.verification_code || args.verificationCode || args['Verification Code'] || args['verification code'] || args.code || '';
  
  // Strip any trailing punctuation or non-digits (e.g., "1234." -> "1234")
  const cleanedCode = String(verification_code).replace(/[^0-9]/g, '').trim();
  const verified = VALID_CODES.includes(cleanedCode);
  return verified
    ? { verified: true, message: 'Identity verified successfully.' }
    : { verified: false, message: 'Verification failed. Incorrect code.' };
}

function log_promise_to_pay(args) {
  const { account_id, ptp_date, amount } = args;
  const ptp_id = `PTP-${ptpCounter++}`;
  const record = { ptp_id, account_id, ptp_date, amount, created_at: new Date().toISOString() };
  ptpStore.push(record);
  return { success: true, ptp_id, confirmed_date: ptp_date, amount };
}

function send_payment_link(args) {
  const { channel = 'SMS' } = args;
  // Mock: no real message is sent
  return {
    success: true,
    message: `Payment link sent successfully via ${channel} (mock).`,
    mock_link: 'https://pay.kapturefinance.mock/ACC-88392',
  };
}

function escalate_to_agent(args) {
  const { reason } = args;
  return {
    success: true,
    escalation_id: `ESC-${Date.now()}`,
    reason,
    message: 'Case routed to human agent queue (mock).',
  };
}

function mark_disposition(args) {
  const { account_id, status, notes } = args;
  const record = {
    account_id,
    status,
    notes: notes || '',
    timestamp: new Date().toISOString(),
  };
  dispositionStore.push(record);
  return { success: true, status, logged_at: record.timestamp };
}

const TOOL_HANDLERS = {
  verify_customer,
  log_promise_to_pay,
  send_payment_link,
  escalate_to_agent,
  mark_disposition,
};

// ---- routes -----------------------------------------------------------

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'maya-mock-server' }));

app.get('/demo-account', (req, res) => res.json(DEMO_ACCOUNT));

app.get('/dispositions', (req, res) => res.json(dispositionStore));
app.get('/ptps', (req, res) => res.json(ptpStore));

/**
 * Main Vapi webhook. Vapi sends tool-call requests as:
 * { message: { toolCalls: [ { id, function: { name, arguments } } ] } }
 * We respond with the { results: [...] } envelope Vapi expects.
 */
app.post('/webhook', (req, res) => {
  try {
    // 1. Detect and handle direct apiRequest tool calls (raw arguments in req.body)
    const isDirectCall = req.body && typeof req.body === 'object' && !req.body.message && !req.body.toolCalls && !req.body.toolCallList;
    if (isDirectCall) {
      let name = '';
      if (req.body.verification_code !== undefined || req.body.verificationCode !== undefined || req.body['Verification Code'] !== undefined || req.body.code !== undefined) {
        name = 'verify_customer';
      } else if (req.body.ptp_date !== undefined || req.body.ptpDate !== undefined || req.body['PTP Date'] !== undefined) {
        name = 'log_promise_to_pay';
      } else if (req.body.channel !== undefined) {
        name = 'send_payment_link';
      } else if (req.body.reason !== undefined) {
        name = 'escalate_to_agent';
      } else if (req.body.status !== undefined) {
        name = 'mark_disposition';
      }

      if (name) {
        const handler = TOOL_HANDLERS[name];
        const result = handler(req.body);
        logToolCall(name, req.body, result);
        return res.json(result); // Return direct JSON response to Vapi
      }
    }

    if (process.env.VAPI_WEBHOOK_SECRET) {
      const secret = req.header('x-vapi-secret');
      if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const toolCalls =
      req.body?.message?.toolCalls ||
      req.body?.toolCalls ||
      (req.body?.message?.toolCallList ?? []);

    // Fallback response for other Vapi event notifications (e.g., status-update, transcript, etc.)
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return res.status(200).json({ status: 'acknowledged' });
    }

    const results = toolCalls.map((call) => {
      const toolCallId = call.id || call.toolCallId;
      const name = call.function?.name || call.name;
      let args = call.function?.arguments || call.arguments || {};
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }

      const handler = TOOL_HANDLERS[name];
      let result;
      if (!handler) {
        result = { success: false, error: `Unknown tool: ${name}` };
      } else {
        result = handler(args);
      }
      logToolCall(name, args, result);
      return { toolCallId, result: JSON.stringify(result) };
    });

    return res.json({ results });
  } catch (err) {
    console.error('[ERROR] /webhook', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Maya mock webhook server listening on http://localhost:${PORT}`);
  console.log(`Expose it publicly with: ngrok http ${PORT}`);
});
