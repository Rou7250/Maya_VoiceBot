/**
 * simulate_call.js
 * 
 * A test script to simulate Vapi webhook tool calls locally.
 * This will populate mock data so you can see it in your browser!
 */

const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          resolve(JSON.parse(responseData));
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

async function runSimulation() {
  console.log('🚀 Starting local simulation of Maya Voicebot Call...\n');

  // Step 1: Simulate Customer Verification
  console.log('1. Simulating verify_customer tool call...');
  const verifyResponse = await post('/webhook', {
    message: {
      toolCalls: [
        {
          id: 'call_verify_001',
          function: {
            name: 'verify_customer',
            arguments: {
              account_id: 'ACC-88392',
              verification_code: '1234'
            }
          }
        }
      ]
    }
  });
  console.log('Response:', JSON.stringify(verifyResponse, null, 2));
  console.log('--------------------------------------------------\n');

  // Step 2: Simulate Logging Promise-to-Pay (PTP)
  console.log('2. Simulating log_promise_to_pay tool call...');
  const ptpResponse = await post('/webhook', {
    message: {
      toolCalls: [
        {
          id: 'call_ptp_001',
          function: {
            name: 'log_promise_to_pay',
            arguments: {
              account_id: 'ACC-88392',
              ptp_date: '2026-08-20',
              amount: 8499
            }
          }
        }
      ]
    }
  });
  console.log('Response:', JSON.stringify(ptpResponse, null, 2));
  console.log('--------------------------------------------------\n');

  // Step 3: Simulate Send Payment Link
  console.log('3. Simulating send_payment_link tool call...');
  const linkResponse = await post('/webhook', {
    message: {
      toolCalls: [
        {
          id: 'call_link_001',
          function: {
            name: 'send_payment_link',
            arguments: {
              account_id: 'ACC-88392',
              channel: 'SMS'
            }
          }
        }
      ]
    }
  });
  console.log('Response:', JSON.stringify(linkResponse, null, 2));
  console.log('--------------------------------------------------\n');

  // Step 4: Simulate Marking Disposition
  console.log('4. Simulating mark_disposition tool call...');
  const dispResponse = await post('/webhook', {
    message: {
      toolCalls: [
        {
          id: 'call_disp_001',
          function: {
            name: 'mark_disposition',
            arguments: {
              account_id: 'ACC-88392',
              status: 'PTP_AGREED',
              notes: 'Customer verified and agreed to pay full amount of 8499 on 2026-08-20.'
            }
          }
        }
      ]
    }
  });
  console.log('Response:', JSON.stringify(dispResponse, null, 2));
  console.log('--------------------------------------------------\n');

  console.log('✅ Simulation completed successfully!');
  console.log('Now refresh http://localhost:3000/dispositions and http://localhost:3000/ptps in your browser to see the data!');
}

runSimulation().catch(console.error);
