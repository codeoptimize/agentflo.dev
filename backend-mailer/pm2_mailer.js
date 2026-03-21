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

function getRandomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Fetch the central source of truth for sent emails directly from GitHub raw content
function fetchSentEmails() {
  try {
    const url = 'https://raw.githubusercontent.com/codeoptimize/data/main/email-history.log';
    // Use curl to download the file directly, avoiding full git clones here
    const content = execSync(`curl -s -H "Authorization: token ${process.env.GH_TOKEN}" ${url}`).toString();
    
    // Extract just the email addresses from the lines using a quick regex
    const sentEmails = [];
    const lines = content.split('\n');
    const regex = /Successfully sent to ([^\s]+) \(/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match && match[1]) {
        sentEmails.push(match[1].toLowerCase());
      }
    }
    return new Set(sentEmails);
  } catch (e) {
    console.log(`[${new Date().toISOString()}] Warning: Could not fetch central log history from Github. Relying on local tracking only.`);
    return new Set();
  }
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

  // Deduplication check: cross-reference local queue against global github history
  const globalSentSet = fetchSentEmails();
  const originalCount = emails.length;
  emails = emails.filter(email => !globalSentSet.has(email.toLowerCase()));
  
  if (emails.length < originalCount) {
    console.log(`[${new Date().toISOString()}] Ephemeral Filter: Removed ${originalCount - emails.length} emails that were already marked as sent in the global GitHub history log.`);
    // Update local file to remove those duplicates immediately
    fs.writeFileSync(EMAIL_LIST_PATH, emails.join('\n') + '\n');
  }

  if (emails.length === 0) {
    console.log(`[${new Date().toISOString()}] All emails processed. Waiting for new emails...`);
    setTimeout(processNextEmail, 300000);
    return;
  }

  const targetEmail = emails[0];
  console.log(`\n[${new Date().toISOString()}] [${emails.length} remaining] Preparing to send to ${targetEmail}...`);

  try {
    const output = execSync(`timeout 30s node mailer.js "${targetEmail}"`, { encoding: 'utf-8' });
    console.log(output.trim());

    // Remove the successfully processed email from the file
    const newFileContent = emails.slice(1).join('\n') + '\n';
    fs.writeFileSync(EMAIL_LIST_PATH, newFileContent);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Execution failed for ${targetEmail}. Error: ${err.message}`);
  }

  // --- HUMAN JITTER DELAY CALCULATION ---
  const MIN_DELAY = 150000;
  const MAX_DELAY = 360000;
  const jitterDelay = getRandomDelay(MIN_DELAY, MAX_DELAY);
  
  const minutes = (jitterDelay / 60000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Human Jitter enabled: Sleeping for ${minutes} minutes before next email...`);
  
  setTimeout(processNextEmail, jitterDelay);
}

// Start the sequence immediately
console.log(`[${new Date().toISOString()}] Starting mailer sequence with Human Jitter and Global Deduplication...`);
processNextEmail();
