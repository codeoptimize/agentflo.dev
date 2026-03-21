const { execSync } = require('child_process');
const fs = require('fs');

const PM2_LOG_PATH = '/home/jules/.pm2/logs/zoho-mailer-out.log';
const REPO_URL = 'https://${process.env.GH_TOKEN}@github.com/codeoptimize/data.git';
const REPO_DIR = '/app/data_repo';
const CLEAN_LOG_PATH = `${REPO_DIR}/email-history.log`;

function runGitSync() {
  try {
    // 1. Ensure the target repository is cloned locally
    if (!fs.existsSync(REPO_DIR)) {
      console.log(`[${new Date().toISOString()}] Cloning data repository...`);
      execSync(`git clone ${REPO_URL} ${REPO_DIR}`);
    } else {
      // Pull latest changes before we start modifying
      execSync('git pull origin main --rebase', { cwd: REPO_DIR });
    }

    // 2. Read the raw PM2 logs
    const rawLogs = fs.readFileSync(PM2_LOG_PATH, 'utf-8');
    
    // 3. Filter for only the "Successfully sent to" lines with timestamps
    const cleanLogs = rawLogs
      .split('\n')
      .filter(line => line.includes('Successfully sent to'))
      .join('\n');
      
    // 4. Write them to the cloned repo directory
    fs.writeFileSync(CLEAN_LOG_PATH, cleanLogs + '\n');
    
    // 5. Configure git identity
    execSync('git config user.email "bot@agentflo.dev"', { cwd: REPO_DIR });
    execSync('git config user.name "AgentFlo Log Bot"', { cwd: REPO_DIR });

    // 6. Check if there are any changes to the email-history.log file
    const status = execSync('git status --porcelain email-history.log', { cwd: REPO_DIR }).toString();
    
    if (status) {
      // Add the file
      execSync('git add email-history.log', { cwd: REPO_DIR });
      
      // Commit the changes (skip CI to prevent infinite build loops)
      execSync('git commit -m "chore(logs): auto-update email history [skip ci]"', { cwd: REPO_DIR });
      
      // Push to the remote branch 'main'
      execSync('git push origin HEAD:main', { cwd: REPO_DIR });
      console.log(`[${new Date().toISOString()}] Successfully synced new logs to GitHub (codeoptimize/data).`);
    } else {
      console.log(`[${new Date().toISOString()}] No new logs to sync.`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error syncing logs to git:`, error.message);
  }
}

// Run immediately, then every 5 minutes (300000 ms)
runGitSync();
setInterval(runGitSync, 300000);
