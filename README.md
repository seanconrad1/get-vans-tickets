# Vans Skate Session Ticket Automation

Automated system to monitor Gmail for Vans Skate Space session announcements and purchase tickets on Eventbrite.

## Prerequisites

1. **gog** - Gmail command line tool (https://github.com/jroimartin/gog)

   ```bash
   go install github.com/jroimartin/gog@latest
   gog auth  # Authenticate with Gmail
   ```

2. **Node.js** - Version 14 or higher

   ```bash
   node --version
   ```

3. **npm** - Comes with Node.js
   ```bash
   npm install
   ```

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file or export variables:

   ```bash
   export EVENTBRITE_EMAIL=""
   export EVENTBRITE_PASSWORD=""  # Optional
   export FIRST_NAME=""
   export LAST_NAME=""
   export HEADLESS=false  # Set to 'true' for headless mode
   ```

3. **Make scripts executable:**
   ```bash
   chmod +x monitor.sh
   ```

## Usage

### Start Monitoring

Run the monitoring script to continuously check for new Vans emails:

```bash
./monitor.sh
```

This will:

- Check Gmail every 60 seconds for emails with subject "Just added! Skate Session 2 from Vans Skate Space 198"
- Extract Eventbrite links from new emails
- Automatically launch the ticket purchase automation
- Track processed emails to avoid duplicates

### Test Ticket Purchase Manually

Test the ticket purchasing script with a specific URL:

```bash
node purchaseTicket.js "https://www.eventbrite.com/e/book-launch-party-push-unlock-the-science-of-fitness-motivation-tickets-1978274701887?aff=ebdssbneighborhoodbrowse"
```

### Configuration

Edit `monitor.sh` to customize:

- `CHECK_INTERVAL`: Seconds between email checks (default: 60)
- `SEARCH_QUERY`: Email subject to search for

Edit `purchaseTicket.js` CONFIG object to customize:

- `ticketQuantity`: Number of tickets to purchase (default: 1)
- `headless`: Run browser in background (default: true)
- `timeout`: Page load timeout in milliseconds (default: 30000)

## How It Works

1. **monitor.sh**:
   - Polls Gmail using `gog` for unread emails matching the subject
   - Extracts Eventbrite links from email content
   - Marks emails as read and tracks processed email IDs
   - Launches purchaseTicket.js with the extracted URL

2. **purchaseTicket.js**:
   - Opens Eventbrite event page using Puppeteer
   - Finds and clicks the registration/ticket button
   - Selects ticket quantity
   - Fills in contact information (email, name)
   - Pauses for manual review before final submission

## Security Notes

- **Never commit credentials** to version control
- Use environment variables for sensitive data
- Consider using a password manager or secure credential storage
- The script pauses before final submission for manual review

## Troubleshooting

**"gog: command not found"**

- Install gog: `go install github.com/jroimartin/gog@latest`
- Ensure Go bin is in PATH: `export PATH=$PATH:$(go env GOPATH)/bin`

**"Could not find ticket button"**

- Run with `HEADLESS=false` to see what the browser sees
- Eventbrite page structure may have changed - update selectors in purchaseTicket.js

**No emails found**

- Check gog authentication: `gog auth`
- Verify email subject matches exactly in monitor.sh
- Check Gmail search syntax: `gog gmail search "your query"`

## Files

- `monitor.sh` - Gmail monitoring loop
- `purchaseTicket.js` - Puppeteer automation script
- `processed_emails.txt` - Tracks processed email IDs
- `package.json` - Node.js dependencies

## Disclaimer

This tool is for educational purposes. Always review automated purchases before completion. Be aware of Eventbrite's terms of service regarding automated access.
# get-vans-tickets
