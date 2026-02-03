# Vans Skate Session Ticket Automation
# See README.md for full documentation

# Quick start:
# 1. Install dependencies: npm install
# 2. Configure environment variables (see README.md)
# 3. Make monitor.sh executable: chmod +x monitor.sh
# 4. Start monitoring: ./monitor.sh

# Manual email extraction (for testing):
# gog gmail get EMAIL_ID | grep -oE 'https://[^[:space:]]*eventbrite[^[:space:]]*' | head -n 1

# Test ticket purchase with specific URL:
# node purchaseTicket.js "https://www.eventbrite.com/e/your-event-id"