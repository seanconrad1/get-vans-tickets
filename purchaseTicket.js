require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Configuration - Update these with your information
const CONFIG = {
  email: process.env.EVENTBRITE_EMAIL || "",
  password: process.env.EVENTBRITE_PASSWORD || "",
  firstName: process.env.FIRST_NAME || "",
  lastName: process.env.LAST_NAME || "",
  ticketQuantity: 1,
  headless: true, // Run in background - set to false to see browser
  timeout: 30000,
};

async function purchaseTicket(eventUrl) {
  console.log("🎫 Starting ticket purchase automation...");
  console.log("Event URL:", eventUrl);

  // Create screenshots directory
  const screenshotDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const timestamp = Date.now();
  let screenshotCount = 0;

  const takeScreenshot = async (page, name) => {
    screenshotCount++;
    const filename = `${timestamp}-${screenshotCount.toString().padStart(2, "0")}-${name}.png`;
    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to event page
    console.log("📍 Navigating to event page...");
    await page.goto(eventUrl, {
      waitUntil: "networkidle2",
      timeout: CONFIG.timeout,
    });

    // Wait a bit for any redirects
    await sleep(2000);
    await takeScreenshot(page, "01-initial-page");

    // Look for "Register" or "Get Tickets" button
    console.log("🔍 Looking for ticket button...");
    const ticketButtonSelectors = [
      'button[data-testid="checkout-link"]',
      'button[data-tracking-label="Register"]',
      'button[data-testid="button-register"]',
      'button:has-text("Reserve a spot")',
      'button:has-text("Get tickets")',
      'a:has-text("Register")',
      'a:has-text("Get tickets")',
      '[data-automation="checkout-button"]',
    ];

    let ticketButton = null;
    for (const selector of ticketButtonSelectors) {
      try {
        ticketButton = await page.waitForSelector(selector, { timeout: 3000 });
        if (ticketButton) {
          console.log("✅ Found ticket button");
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!ticketButton) {
      // Try clicking anything that looks like a register button
      const buttons = await page.$$("button, a");
      for (const button of buttons) {
        const text = await page.evaluate((el) => el.textContent, button);
        if (
          text &&
          (text.toLowerCase().includes("register") ||
            text.toLowerCase().includes("tickets"))
        ) {
          ticketButton = button;
          console.log("✅ Found ticket button by text content");
          break;
        }
      }
    }

    if (!ticketButton) {
      await takeScreenshot(page, "ERROR-no-ticket-button");
      throw new Error("Could not find ticket/register button");
    }

    // Click ticket button
    console.log("🖱️  Clicking ticket button...");
    await ticketButton.click();
    await sleep(1000);
    await takeScreenshot(page, "02-after-ticket-button-click");

    // Wait for iframe modal to appear
    console.log("⏳ Waiting for iframe modal to load...");

    // Find and switch to the iframe
    let frame = null;
    try {
      const iframeElement = await page.waitForSelector(
        'iframe[id*="eventbrite-widget-modal"], iframe[data-automation*="checkout-widget-iframe"]',
        { timeout: 10000, visible: true },
      );
      console.log("✅ Found iframe");
      frame = await iframeElement.contentFrame();

      if (frame) {
        console.log("✅ Switched to iframe context");
        await takeScreenshot(page, "03-iframe-loaded");
      } else {
        throw new Error("Could not get iframe content");
      }
    } catch (e) {
      console.log("⚠️  Could not find iframe, trying main page context...");
      frame = page; // Fall back to main page
    }

    // Select ticket quantity if needed (in iframe context)
    console.log("🎟️  Selecting tickets...");
    let ticketSelected = false;

    // Try method 1: Stepper button
    // try {
    //   // Look for General Admission ticket
    //   const ticketNameElement = await frame.waitForSelector(
    //     'div[data-testid="ticket-name-wrapper"]',
    //     { timeout: 5000 },
    //   );

    //   if (ticketNameElement) {
    //     const ticketText = await frame.evaluate(
    //       (el) => el.textContent,
    //       ticketNameElement,
    //     );
    //     console.log(`✅ Found ticket: ${ticketText}`);

    //     // Click the increase button to add ticket
    //     const increaseButton = await frame.waitForSelector(
    //       'button[data-testid="eds-stepper-increase-button"]',
    //       { timeout: 3000 },
    //     );

    //     if (increaseButton) {
    //       await increaseButton.click();
    //       console.log("✅ Clicked increase button to add 1 ticket");
    //       await sleep(500);
    //       await takeScreenshot(page, "04-after-quantity-select");
    //       ticketSelected = true;
    //     }
    //   }
    // } catch (e) {
    //   console.log("⚠️  Stepper button not found, trying dropdown selector...");
    // }

    // Try method 2: Dropdown selector
    if (!ticketSelected) {
      try {
        const dropdown = await frame.waitForSelector(
          'select[data-automation*="ticket-quantity-selector"]',
          { timeout: 3000 },
        );

        if (dropdown) {
          await frame.evaluate((select) => {
            select.value = "1";
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }, dropdown);
          console.log("✅ Selected 1 ticket from dropdown");
          await sleep(500);
          await takeScreenshot(page, "04-after-quantity-select");
          ticketSelected = true;
        }
      } catch (e) {
        console.log("⚠️  Dropdown selector not found either, proceeding...");
      }
    }
    // Log all buttons in the iframe to help debug
    try {
      const allButtons = await frame.$$eval("button", (buttons) =>
        buttons.map((btn) => ({
          text: btn.textContent?.trim().substring(0, 50),
          dataTestId: btn.getAttribute("data-testid"),
          dataAutomation: btn.getAttribute("data-automation"),
          dataSpec: btn.getAttribute("data-spec"),
          type: btn.getAttribute("type"),
          visible: btn.offsetParent !== null,
        })),
      );
      console.log(
        "📋 All buttons found in iframe:",
        JSON.stringify(allButtons, null, 2),
      );
    } catch (e) {
      console.log("⚠️  Could not list buttons");
    }

    const checkoutSelectors = [
      'button[data-testid="eds-modal__primary-button"]',
      'button[data-automation="eds-modal__primary-button"]',
      'button[data-spec="eds-modal__primary-button"]',
      'button[type="submit"]',
      'button:has-text("Checkout")',
      'button:has-text("Continue")',
      'button:has-text("Register")',
      '[data-automation="checkout-button"]',
    ];

    let checkoutButton = null;
    for (const selector of checkoutSelectors) {
      try {
        checkoutButton = await frame.waitForSelector(selector, {
          timeout: 2000,
          visible: true,
        });
        if (checkoutButton) {
          console.log(`✅ Found checkout button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (checkoutButton) {
      console.log("🖱️  Waiting before clicking checkout button...");
      await sleep(2000);
      console.log("🖱️  Clicking checkout button now...");

      // Try multiple click methods
      try {
        await checkoutButton.click();
      } catch (clickError) {
        console.log("⚠️  Standard click failed, trying JavaScript click...");
        await frame.evaluate((btn) => btn.click(), checkoutButton);
      }

      await sleep(2000);
      await takeScreenshot(page, "05-after-checkout-click");
    } else {
      console.log("⚠️  Checkout button not found, proceeding to form fill...");
      await takeScreenshot(page, "05-no-checkout-button");
    }

    // Wait for form to appear after selecting ticket
    console.log("⏳ Waiting for form to load...");

    // Wait for the email field to appear instead of fixed sleep
    try {
      await frame.waitForSelector(
        'input[data-automation="checkout-form-N-email"], input[id="buyer.N-email"], input[name="buyer.N-email"], input[type="email"]',
        { timeout: 10000, visible: true },
      );
      console.log("✅ Form loaded - email field detected");
    } catch (e) {
      console.log("⚠️  Email field not detected, proceeding anyway...");
    }

    await takeScreenshot(page, "05-form-loaded");

    // Fill in contact information (in iframe context)
    console.log("📝 Filling in contact information...");

    // Email
    try {
      const emailInput = await frame.waitForSelector(
        'input[data-automation="checkout-form-N-email"], input[id="buyer.N-email"], input[name="buyer.N-email"], input[type="email"]',
        { timeout: 5000 },
      );
      await emailInput.type(CONFIG.email);
      console.log("✅ Email filled");
    } catch (e) {
      console.log("⚠️  Email field not found or already filled");
    }

    // Confirm Email
    try {
      const confirmEmailInput = await frame.waitForSelector(
        'input[data-automation="checkout-form-confirmEmailAddress"], input[id="buyer.confirmEmailAddress"], input[name*="confirmEmail"]',
        { timeout: 5000 },
      );
      await confirmEmailInput.type(CONFIG.email);
      console.log("✅ Confirm email filled");
    } catch (e) {
      console.log("⚠️  Confirm email field not found");
    }

    // First name
    try {
      const firstNameInput = await frame.waitForSelector(
        'input[data-automation="checkout-form-N-first_name"], input[id="buyer.N-first_name"], input[name*="first"], input[id*="first"]',
        { timeout: 5000 },
      );
      await firstNameInput.type(CONFIG.firstName);
      console.log("✅ First name filled");
    } catch (e) {
      console.log("⚠️  First name field not found");
    }

    // Last name
    try {
      const lastNameInput = await frame.waitForSelector(
        'input[data-automation="checkout-form-N-last_name"], input[id="buyer.N-last_name"], input[name*="last"], input[id*="last"]',
        { timeout: 5000 },
      );
      await lastNameInput.type(CONFIG.lastName);
      console.log("✅ Last name filled");
    } catch (e) {
      console.log("⚠️  Last name field not found");
    }

    await takeScreenshot(page, "06-after-name-fields");

    // Look for final submit button (in iframe context)
    console.log("🔍 Looking for submit button...");
    const submitSelectors = [
      'button[data-testid="eds-modal__primary-button"]',
      'button[data-automation="eds-modal__primary-button"]',
      'button[data-spec="eds-modal__primary-button"]',
      'button[type="submit"]',
      'button:has-text("Place Order")',
      'button:has-text("Complete Registration")',
      'button:has-text("Register")',
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await frame.waitForSelector(selector, { timeout: 3000 });
        if (submitButton) break;
      } catch (e) {
        continue;
      }
    }

    if (submitButton) {
      await takeScreenshot(page, "07-ready-to-submit");
      console.log("🖱️  Clicking Register button...");
      await submitButton.click();
      await sleep(3000);
      await takeScreenshot(page, "08-after-register-click");
      console.log("✅ Register button clicked!");

      // Keep browser open to see result
      if (!CONFIG.headless) {
        console.log("⏸️  Keeping browser open for review...");
        await sleep(60000); // Wait 1 minute to review
      }
    } else {
      console.log("⚠️  Submit button not found");
      await takeScreenshot(page, "ERROR-no-submit-button");
    }

    console.log("✅ Automation complete! Check browser for final status.");
    console.log(`📁 Screenshots saved in: ${screenshotDir}`);
  } catch (error) {
    console.error("❌ Error during ticket purchase:", error.message);
    try {
      await takeScreenshot(page, "ERROR-final");
    } catch (screenshotError) {
      console.log("⚠️  Could not take error screenshot");
    }
    throw error;
  } finally {
    if (CONFIG.headless) {
      await browser.close();
    } else {
      console.log(
        "Browser left open for manual review. Close manually when done.",
      );
    }
  }
}

// Main execution
const eventUrl = process.argv[2];

if (!eventUrl) {
  console.error("❌ Error: No event URL provided");
  console.log("Usage: node purchaseTicket.js <eventbrite-url>");
  process.exit(1);
}

if (!CONFIG.email || !CONFIG.firstName || !CONFIG.lastName) {
  console.log("⚠️  Warning: Email, first name, or last name not configured");
  console.log(
    "Set environment variables: EVENTBRITE_EMAIL, FIRST_NAME, LAST_NAME",
  );
}

purchaseTicket(eventUrl)
  .then(() => {
    console.log("✅ Ticket purchase script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
