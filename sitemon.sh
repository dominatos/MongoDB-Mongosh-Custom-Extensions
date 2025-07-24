#!/bin/bash

# Source the configuration file to load variables like SITES, LOG_DIR, etc.
source /etc/sitemon/sitemon.conf

# Function to send messages to Telegram
# Arguments:
#   $1 - The message text to send
send_telegram_message() {
    local message="$1"
    # Check if Telegram notifications are enabled (0 means enabled)
    if [ "$disable_telegram" -eq 0 ]; then
        # Use curl to send a POST request to the Telegram Bot API
        # -s: Silent mode, don't show progress meter or error messages
        # -X POST: Specify POST request method
        # -d: Send data in the application/x-www-form-urlencoded format
        # parse_mode=HTML: Allows for basic HTML formatting in the message
        curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
            -d "chat_id=${CHAT_ID}" \
            -d "text=${message}" \
            -d "parse_mode=HTML" >/dev/null # Redirect output to /dev/null
    fi
}

# Function for logging messages to the main log file and sending to Telegram
# Arguments:
#   $1 - The message text to log
log_service() {
    # Print the timestamped message to the main log file (LOG_FILE) and stderr
    # tee -a: Append to the file and also print to stdout (>&2 redirects stdout to stderr)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE" >&2
    # Send the same message to Telegram
    send_telegram_message "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if log flushing is enabled at script start (0 means no flush, 1 means flush)
if [ "$flush_log_on_start" -eq 0 ]; then
    # Log the script start message to the main log and stderr, then send to Telegram
    # PID $$: Current process ID of the script
    log_service "Script is started. PID $$" | tee "$LOG_FILE" >&2
    send_telegram_message "Script is started on $HOSTNAME. PID $$"
else
    # If log flushing is enabled, clear the individual site logs
    for site in "${SITES[@]}"; do
        # Create an empty file, effectively clearing its content
        # "${site//\//_}.log": Replaces slashes in site name with underscores for valid filenames
        echo >"${LOG_DIR}/${site//\//_}.log"
    done
    # Log the script start message to the main log and stderr, then send to Telegram
    echo "[$(date +"%Y-%m-%d %H:%M:%S")]  Script is started. PID $$" | tee "$LOG_FILE" >&2
    send_telegram_message "[$(date +"%Y-%m-%d %H:%M:%S")] Script is started. PID $$"
fi

# Set up a trap to handle the SIGTERM signal (e.g., when the script is gracefully stopped)
# On SIGTERM:
# 1. Log a message indicating the script is finishing.
# 2. pkill -P $$: Kill all child processes whose parent PID is the current script's PID.
# 3. exit 0: Exit the script successfully.
trap 'log_service "Received signal SIGTERM. Finishing the script on $HOSTNAME..."; pkill -P $$; exit 0' SIGTERM

# Main site monitoring function
# Arguments:
#   $1 - The site URL to monitor (e.g., "3di.it/")
#   $2 - The monitoring interval in seconds
sitemon(){
    local lastOK=""    # Stores the timestamp of the last successful check
    local lastFAIL=""  # Stores the timestamp of the last failed check
    local site=$1      # The site URL being monitored in this instance
    local interval=$2  # The check interval for this site
    
    local status=1     # Current status: 1 for OK, 0 for FAIL
    # Construct the path to the individual log file for this site
    local logfile="${LOG_DIR}/${site//\//_}.log"

    # Inner logging function specific to the sitemon process
    # This function logs to the individual site's log file and potentially sends Telegram messages
    # Arguments:
    #   $1 - The message text to log
    log() {
        # Print the timestamped message to the individual site log and stderr
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$logfile" >&2
        # Only send a Telegram message if the status is currently FAIL (0)
        # This prevents spamming Telegram with "OK" messages for every successful check
        if [ "$status" -eq 0 ]; then
            send_telegram_message "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
        fi
    }

    # Log the start of monitoring for this specific site
    log "Monitoring started for $site (PID $$)"

    local count=0 # Counter for consecutive failed checks

    # Infinite loop for continuous monitoring
    while true; do
        # Use curl to get the HTTP response code for the site
        # -sL: Silent mode, follow redirects
        # -o /dev/null: Discard the output body
        # -w "%{http_code}": Print only the HTTP response code
        local respcode=$(curl -sL -o /dev/null -w "%{http_code}" http://$site)

        # Check if the response code is 200 (OK)
        if [ "$respcode" -eq 200 ]; then
            # If the site was previously down (status=0)
            if [ "$status" -eq 0 ]; then
                # If there was a recorded last failure timestamp
                if ! [ -z "$lastFAIL" ]; then
                    # Calculate and log the duration of the downtime
                    log "Last fail: $lastFAIL lasted $error_duration seconds"
                    # Send a Telegram notification that the site is back online
                    send_telegram_message "$site is back online. Downtime was $error_duration seconds"
                fi
            fi
            status=1 # Set status to OK
            log "$site response OK"
            lastOK=$(date '+%Y-%m-%d %H:%M:%S') # Update the last OK timestamp
            count=0 # Reset fail counter on success
        else
            status=0 # Set status to FAIL
            # Log failure message only for the first few consecutive failures (up to 3)
            if [ "$count" -lt 4 ]; then
                log "$site response FAIL with code $respcode"
            fi
            count=$((count+1)) # Increment fail counter
            # Calculate the total duration of the error state
            error_duration=$((count * interval))
            # If there have been 12 or more consecutive failures (i.e., count > 12 after increment)
            if [ "$((count % 12))" -eq 0 ]; then
                
                
                # Send a critical alert to the log and Telegram
                log "ALERT: $site DOWN! for $error_duration seconds. Last ok: $lastOK"
                lastFAIL=$(date '+%Y-%m-%d %H:%M:%S') # Update the last FAIL timestamp
            fi
        fi
        sleep "$interval" # Wait for the specified interval before the next check
    done
}

# Loop through each site defined in the SITES array from sitemon.conf
for site in "${SITES[@]}"; do
    # Call the sitemon function for each site in a background process (&)
    # This allows concurrent monitoring of multiple sites
    sitemon "$site" "$interval" &
done

# Wait for all background sitemon processes to complete
# This command will keep the main script running until all child processes exit.
wait
