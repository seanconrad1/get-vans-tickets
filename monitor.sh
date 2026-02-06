#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration
SEARCH_QUERY="Just added! Skate Session"
CHECK_INTERVAL=60  # seconds between checks
PROCESSED_FILE="processed_emails.txt"

# Set GOG account from .env for PM2 environment
export GOG_ACCOUNT="${EVENTBRITE_EMAIL}"

# Create processed emails file if it doesn't exist
touch "$PROCESSED_FILE"

echo "🛹 Monitoring Gmail for Vans Skate Session emails..."
echo "Checking every ${CHECK_INTERVAL} seconds"
echo "Search query: ${SEARCH_QUERY}"
echo "Processed file: ${PROCESSED_FILE}"
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "Gog version: $(gog --version 2>&1 || echo 'unable to detect')"
echo ""

while true; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting email check cycle..."
    
    # Search for unread emails with the subject
    echo "  [DEBUG] Running gog gmail search command..."
    GOG_SEARCH_OUTPUT=$(gog gmail search "subject:\"${SEARCH_QUERY}\" is:unread" 2>&1)
    echo "  [DEBUG] Raw gog output: $GOG_SEARCH_OUTPUT"
    
    EMAIL_IDS=$(echo "$GOG_SEARCH_OUTPUT" | grep -oE '[0-9a-f]{16}' | head -n 5)
    echo "  [DEBUG] Extracted email IDs: ${EMAIL_IDS:-'(none)'}"
    EMAIL_IDS=$(echo "$GOG_SEARCH_OUTPUT" | grep -oE '[0-9a-f]{16}' | head -n 5)
    echo "  [DEBUG] Extracted email IDs: ${EMAIL_IDS:-'(none)'}"
    
    if [ ! -z "$EMAIL_IDS" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ✉️  Found unread emails!"
        EMAIL_COUNT=$(echo "$EMAIL_IDS" | wc -l)
        echo "  [DEBUG] Processing $EMAIL_COUNT email(s)"
        
        for EMAIL_ID in $EMAIL_IDS; do
            echo "  [DEBUG] Checking email ID: $EMAIL_ID"
            
            # Check if we've already processed this email
            if grep -q "$EMAIL_ID" "$PROCESSED_FILE"; then
                echo "  ⏭️  Already processed: $EMAIL_ID (skipping)"
                continue
            fi
            
            echo "  🆕 Processing new email: $EMAIL_ID"
            
            # Extract Eventbrite link
            echo "  [DEBUG] Fetching email content..."
            EMAIL_CONTENT=$(gog gmail get "$EMAIL_ID" 2>&1)
            echo "  [DEBUG] Email content length: ${#EMAIL_CONTENT} characters"
            
            EVENTBRITE_LINK=$(echo "$EMAIL_CONTENT" | grep -oE 'https://[^[:space:]]*eventbrite[^[:space:]]*' | head -n 1)
            echo "  [DEBUG] Extracted Eventbrite link: ${EVENTBRITE_LINK:-'(none found)'}"
            EVENTBRITE_LINK=$(echo "$EMAIL_CONTENT" | grep -oE 'https://[^[:space:]]*eventbrite[^[:space:]]*' | head -n 1)
            echo "  [DEBUG] Extracted Eventbrite link: ${EVENTBRITE_LINK:-'(none found)'}"
            
            if [ ! -z "$EVENTBRITE_LINK" ]; then
                echo "  🎟️  Found Eventbrite link: $EVENTBRITE_LINK"
                
                # Mark email as read
                echo "  [DEBUG] Marking email as read..."
                gog gmail modify "$EMAIL_ID" --remove-label UNREAD 2>&1
                
                # Record that we've processed this email
                echo "  [DEBUG] Recording email ID to processed file..."
                echo "$EMAIL_ID" >> "$PROCESSED_FILE"
                echo "  [DEBUG] Total processed emails: $(wc -l < $PROCESSED_FILE)"
                
                # Launch ticket purchasing automation
                echo "  🎫 Launching ticket purchase automation..."
                echo "  [DEBUG] Running: node purchaseTicket.js \"$EVENTBRITE_LINK\""
                
                node purchaseTicket.js "$EVENTBRITE_LINK"
                EXIT_CODE=$?
                
                echo "  [DEBUG] Purchase script exit code: $EXIT_CODE"
                
                if [ $EXIT_CODE -eq 0 ]; then
                    echo "  ✅ Ticket purchase automation completed successfully!"
                else
                    echo "  ❌ Ticket purchase automation failed (exit code: $EXIT_CODE)"
                fi
            else
                echo "  ⚠️  No Eventbrite link found in email ID: $EMAIL_ID"
                echo "  [DEBUG] Email snippet: ${EMAIL_CONTENT:0:200}..."
            fi
            
            echo ""
        done
    else
        echo -ne "$(date '+%Y-%m-%d %H:%M:%S') - 💤 No new emails found (sleeping ${CHECK_INTERVAL}s)\r"
    fi
    
    echo "  [DEBUG] Cycle complete. Sleeping for ${CHECK_INTERVAL} seconds..."
    sleep "$CHECK_INTERVAL"
done
