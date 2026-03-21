require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');
const express = require('express');

// --- 1. DUMMY WEB SERVER TO PREVENT RENDER SLEEP ---
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('AgentFlo Mailer is awake and running!');
});

app.get('/ping', (req, res) => {
  console.log(`[${new Date().toISOString()}] Received ping from external service. Container is awake!`);
  res.send('Pong!');
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Dummy Web Server listening on port ${PORT} to prevent Render from sleeping.`);
});

// --- 2. THE MAILER SCRIPT WITH HUMAN JITTER ---
const EMAIL_LIST_PATH = './emails.txt';

// Helper to generate a random delay between min and max (in milliseconds)
function getRandomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function processNextEmail() {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.error(`[${new Date().toISOString()}] Error: Missing SMTP credentials.`);
    return;
  }

  let emails = [];
  try {
    const fileContent = fs.readFileSync(EMAIL_LIST_PATH, 'utf-8');
    emails = fileContent
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error reading list`);
    return;
  }

  if (emails.length === 0) {
    console.log(`[${new Date().toISOString()}] All emails processed. Waiting for new emails...`);
    // Check again in 5 minutes just in case the file is refilled
    setTimeout(processNextEmail, 300000);
    return;
  }

  const targetEmail = emails[0];
  console.log(`\n[${new Date().toISOString()}] [${emails.length} remaining] Preparing to send to ${targetEmail}...`);

  try {
    // We execute mailer.js using node instead of dotenvx run since dotenv.config() is inside mailer.js now
    const output = execSync(`timeout 30s node mailer.js "${targetEmail}"`, { encoding: 'utf-8' });
    console.log(output.trim());

    // Remove the successfully processed email from the file
    const newFileContent = emails.slice(1).join('\n') + '\n';
    fs.writeFileSync(EMAIL_LIST_PATH, newFileContent);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Execution failed for ${targetEmail}. Error: ${err.message}`);
    // If we get blocked (like the 550 5.4.6 error), we should NOT delete the email.
    // However, if the email was malformed, we should skip it.
    // For now, let's keep the email in the list so it can be retried later when Zoho lifts the ban,
    // but we will impose a very long wait time.
    
    // Instead of deleting, just log it. The script will simply retry it next time.
  }

  // --- HUMAN JITTER DELAY CALCULATION ---
  // To bypass Zoho's dynamic velocity filters, sleep for a random duration
  // between 2.5 minutes (150,000 ms) and 6 minutes (360,000 ms).
  const MIN_DELAY = 150000;
  const MAX_DELAY = 360000;
  const jitterDelay = getRandomDelay(MIN_DELAY, MAX_DELAY);
  
  const minutes = (jitterDelay / 60000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Human Jitter enabled: Sleeping for ${minutes} minutes before next email...`);
  
  setTimeout(processNextEmail, jitterDelay);
}

// Start the sequence immediately
console.log(`[${new Date().toISOString()}] Starting mailer sequence with Human Jitter...`);
processNextEmail();
