#!/bin/bash
EMAIL_FILE="emails.txt"
LOG_FILE="mailer.log"

echo "Started sending at $(date)" > $LOG_FILE
TOTAL=$(grep -c "^" $EMAIL_FILE)
echo "Found $TOTAL email(s) in the list." >> $LOG_FILE

# Process line by line
i=1
while IFS= read -r email; do
  # Skip empty lines
  if [[ -z "$email" ]]; then
    continue
  fi
  
  echo "[$i of $TOTAL] Preparing to send to $email..." >> $LOG_FILE
  
  # Run node with a hard 30 second bash-level kill timeout
  # to physically prevent any hanging node processes.
  timeout 30s node mailer.js "$email" >> $LOG_FILE 2>&1
  
  # If the exit code is 124, timeout killed it
  if [ $? -eq 124 ]; then
     echo "Failed to send to $email: Node process hung and was forcefully killed by OS timeout." >> $LOG_FILE
  fi
  
  # Remove the email we just processed so it doesn't get run again on restart
  sed -i "1d" "$EMAIL_FILE"

  if [ $i -lt $TOTAL ]; then
    echo "Waiting 1 minutes before next send to mimic human typing and avoid overwhelming the server..." >> $LOG_FILE
    sleep 60
  fi
  
  i=$((i+1))
done < "$EMAIL_FILE"

echo "All emails processed successfully." >> $LOG_FILE
