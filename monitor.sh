#!/bin/bash

# Configuration
SEARCH_QUERY="Just added! Skate Session 2 from Vans Skate Space 198"
CHECK_INTERVAL=60  # seconds between checks
PROCESSED_FILE="processed_emails.txt"

# Create processed emails file if it doesn't exist
touch "$PROCESSED_FILE"

echo "🛹 Monitoring Gmail for Vans Skate Session emails..."
echo "Checking every ${CHECK_INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    # Search for unread emails with the subject
    EMAIL_IDS=$(gog gmail search "subject:\"${SEARCH_QUERY}\" is:unread" | grep -oE '[0-9a-f]{16}' | head -n 5)
    
    if [ ! -z "$EMAIL_IDS" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Found unread emails!"
        
        for EMAIL_ID in $EMAIL_IDS; do
            # Check if we've already processed this email
            if grep -q "$EMAIL_ID" "$PROCESSED_FILE"; then
                echo "  Already processed: $EMAIL_ID"
                continue
            fi
            
            echo "  Processing new email: $EMAIL_ID"
            
            # Extract Eventbrite link
            EVENTBRITE_LINK=$(gog gmail get "$EMAIL_ID" | grep -oE 'https://[^[:space:]]*eventbrite[^[:space:]]*' | head -n 1)
            
            if [ ! -z "$EVENTBRITE_LINK" ]; then
                echo "  Found Eventbrite link: $EVENTBRITE_LINK"
                
                # Mark email as read
                gog gmail modify "$EMAIL_ID" --remove-label UNREAD
                
                # Record that we've processed this email
                echo "$EMAIL_ID" >> "$PROCESSED_FILE"
                
                # Launch ticket purchasing automation
                echo "  🎫 Launching ticket purchase automation..."
                node purchaseTicket.js "$EVENTBRITE_LINK"
                
                if [ $? -eq 0 ]; then
                    echo "  ✅ Ticket purchase automation completed!"
                else
                    echo "  ❌ Ticket purchase automation failed"
                fi
            else
                echo "  ⚠️  No Eventbrite link found in email"
            fi
            
            echo ""
        done
    else
        echo -ne "$(date '+%Y-%m-%d %H:%M:%S') - No new emails found\r"
    fi
    
    sleep "$CHECK_INTERVAL"
done
