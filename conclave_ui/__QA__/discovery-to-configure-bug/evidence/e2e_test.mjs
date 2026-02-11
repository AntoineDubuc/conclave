/**
 * End-to-End Test: Discovery → Configure Flow (Advanced Mode)
 *
 * Tests the complete wizard flow:
 *   Choice → Flow Type → Mode → Models → Discovery → Configure
 *
 * Verifies that Discovery chat conversation gets synthesized
 * into a task description that pre-fills the TaskInput.
 */

import { chromium } from "playwright";
import { join } from "path";

const ASSETS_DIR = "/Users/aientourage/Desktop/Antoine/Conclave/conclave_ui/__QA__/discovery-to-configure-bug/evidence/assets";
const BASE_URL = "http://localhost:4100";

async function screenshot(page, name, description) {
  const path = join(ASSETS_DIR, name);
  await page.screenshot({ path, fullPage: true });
  console.log(`[SCREENSHOT] ${name} - ${description}`);
}

async function run() {
  console.log("=== Starting E2E Test: Discovery → Configure Flow ===\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Listen for console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  try {
    // =========================================================================
    // STEP 1: Navigate to /flows/new (starts at Choice step)
    // =========================================================================
    console.log("\n--- Step 1: Navigate to /flows/new ---");
    await page.goto(`${BASE_URL}/flows/new`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await screenshot(page, "e2e_01_choice_step.png", "Choice step - Use Existing or Create New");

    // Click "Use an Existing Flow" option
    // Look for the card/button that represents "existing"
    const existingBtn = page.locator('text=Use an Existing Flow').first();
    if (await existingBtn.isVisible()) {
      console.log("  Found 'Use an Existing Flow' button, clicking...");
      await existingBtn.click();
    } else {
      // Try alternative selectors
      const existingCard = page.locator('[data-choice="existing"]').first();
      if (await existingCard.isVisible()) {
        await existingCard.click();
      } else {
        // Try clicking on any card with "existing" text
        const cards = page.locator('button, [role="button"], div[class*="cursor-pointer"]');
        const count = await cards.count();
        console.log(`  Found ${count} clickable elements, looking for existing flow option...`);

        // Take a closer look at the page content
        const pageContent = await page.textContent("body");
        console.log("  Page contains text about: ", pageContent.substring(0, 500));

        // Try clicking first card-like element
        const firstCard = page.locator('button:has-text("Existing"), button:has-text("existing"), div:has-text("Existing Flow")').first();
        if (await firstCard.isVisible()) {
          await firstCard.click();
        } else {
          console.log("  WARNING: Could not find 'Use Existing Flow' button. Trying alternative approach...");
          // Navigate directly with step param
          await page.goto(`${BASE_URL}/flows/new?step=flow-type`, { waitUntil: "networkidle" });
        }
      }
    }
    await page.waitForTimeout(1500);

    // =========================================================================
    // STEP 2: Flow Type Selection
    // =========================================================================
    console.log("\n--- Step 2: Select Flow Type ---");
    await screenshot(page, "e2e_02_flow_type.png", "Flow Type selection step");

    // Look for Round-Robin flow type card and click it
    const roundRobinCard = page.locator('text=Round-Robin').first();
    if (await roundRobinCard.isVisible()) {
      console.log("  Found 'Round-Robin' option, clicking...");
      await roundRobinCard.click();
      await page.waitForTimeout(500);
    } else {
      console.log("  WARNING: Round-Robin not found, checking page content...");
      const content = await page.textContent("body");
      console.log("  Page text: ", content.substring(0, 500));
    }

    // Click Continue button
    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible()) {
      // Check if it's enabled
      const isDisabled = await continueBtn.getAttribute("disabled");
      console.log(`  Continue button disabled: ${isDisabled}`);
      if (!isDisabled) {
        await continueBtn.click();
        console.log("  Clicked Continue");
      } else {
        console.log("  Continue button is disabled. Need to select a flow first.");
        // Try clicking on any flow card
        const flowCards = page.locator('[class*="cursor-pointer"]:has-text("Round")');
        if (await flowCards.first().isVisible()) {
          await flowCards.first().click();
          await page.waitForTimeout(500);
          await continueBtn.click();
        }
      }
    }
    await page.waitForTimeout(1500);

    // =========================================================================
    // STEP 3: Mode Selection (should pick Advanced)
    // =========================================================================
    console.log("\n--- Step 3: Select Mode (Advanced) ---");
    await screenshot(page, "e2e_03_mode_selection.png", "Mode selection step");

    // Look for Advanced mode button/card
    const advancedBtn = page.locator('text=Advanced').first();
    if (await advancedBtn.isVisible()) {
      console.log("  Found 'Advanced' option, clicking...");
      await advancedBtn.click();
    } else {
      console.log("  WARNING: Advanced option not visible. Page might have auto-advanced.");
      const pageText = await page.textContent("body");
      console.log("  Current page content: ", pageText.substring(0, 300));
    }
    await page.waitForTimeout(1500);
    await screenshot(page, "e2e_03b_after_mode.png", "After mode selection");

    // =========================================================================
    // STEP 4: Model Selection
    // =========================================================================
    console.log("\n--- Step 4: Select Models ---");
    await screenshot(page, "e2e_04_models_step.png", "Models selection step");

    // We need to select at least 2 models
    // Look for model checkboxes/cards
    const pageText = await page.textContent("body");
    console.log("  Current page text (first 500 chars): ", pageText.substring(0, 500));

    // Try to find model selection elements - they might be cards with provider names
    // Look for provider/model checkboxes or toggles
    const modelCards = page.locator('[class*="model"], [data-testid*="model"], button:has-text("Claude"), button:has-text("GPT"), button:has-text("Gemini")');
    const modelCount = await modelCards.count();
    console.log(`  Found ${modelCount} model-related elements`);

    // Try different selectors for model cards in TieredModelPicker
    // The component uses checkboxes/cards grouped by tier
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`  Found ${checkboxCount} checkboxes`);

    if (checkboxCount >= 2) {
      // Click first two checkboxes
      await checkboxes.nth(0).click();
      await page.waitForTimeout(300);
      await checkboxes.nth(1).click();
      await page.waitForTimeout(300);
      console.log("  Selected 2 models via checkboxes");
    } else {
      // Try finding clickable model cards
      // Look for any cards that might represent models
      const allButtons = page.locator('button');
      const btnCount = await allButtons.count();
      console.log(`  Total buttons on page: ${btnCount}`);

      // Try to find model cards by looking at common patterns
      // The TieredModelPicker likely shows providers with their models
      const providerSections = page.locator('[class*="provider"], [class*="tier"]');
      const sectionCount = await providerSections.count();
      console.log(`  Provider/tier sections: ${sectionCount}`);

      // Let's try clicking on specific model names that are likely present
      const modelNames = ["Claude", "GPT", "Gemini", "Llama", "Grok"];
      let modelsSelected = 0;
      for (const name of modelNames) {
        if (modelsSelected >= 2) break;
        const modelEl = page.locator(`text=${name}`).first();
        if (await modelEl.isVisible()) {
          try {
            await modelEl.click();
            modelsSelected++;
            console.log(`  Clicked on ${name}`);
            await page.waitForTimeout(300);
          } catch (e) {
            console.log(`  Failed to click ${name}: ${e.message}`);
          }
        }
      }

      if (modelsSelected < 2) {
        console.log("  WARNING: Could not select 2 models via text. Trying to find toggle/select elements...");
        // Take a screenshot to see what's on the page
        await screenshot(page, "e2e_04b_model_debug.png", "Debug: model selection state");

        // Try clicking on div elements that look like cards
        const cardLike = page.locator('div[class*="rounded"][class*="border"][class*="cursor"]');
        const cardCount = await cardLike.count();
        console.log(`  Card-like elements: ${cardCount}`);
        for (let i = 0; i < Math.min(2, cardCount); i++) {
          await cardLike.nth(i).click();
          await page.waitForTimeout(300);
        }
      }
    }

    await page.waitForTimeout(1000);
    await screenshot(page, "e2e_04c_models_selected.png", "After model selection");

    // Click Continue to go to Discovery
    const continueBtn2 = page.locator('button:has-text("Continue")').first();
    if (await continueBtn2.isVisible()) {
      const isDisabled2 = await continueBtn2.getAttribute("disabled");
      console.log(`  Continue button disabled: ${isDisabled2}`);
      if (!isDisabled2) {
        await continueBtn2.click();
        console.log("  Clicked Continue to proceed to Discovery");
      } else {
        console.log("  ERROR: Continue button is still disabled. Need at least 2 models.");
      }
    }
    await page.waitForTimeout(2000);

    // =========================================================================
    // STEP 5: Discovery Chat
    // =========================================================================
    console.log("\n--- Step 5: Discovery Chat ---");
    await screenshot(page, "e2e_05_discovery_step.png", "Discovery chat step");

    // Check if we're on the Discovery step
    const discoveryHeader = page.locator('text=Discovery Chat');
    const skipBtn = page.locator('button:has-text("Skip")');

    if (await skipBtn.isVisible()) {
      console.log("  Discovery step is active (found Skip button)");
    } else {
      console.log("  WARNING: May not be on Discovery step. Checking page...");
      const currentText = await page.textContent("body");
      console.log("  Page text (first 300): ", currentText.substring(0, 300));
    }

    // Find the chat input textarea
    const chatInput = page.locator('textarea[placeholder*="Explore"], textarea[placeholder*="ideas"], textarea').first();
    if (await chatInput.isVisible()) {
      console.log("  Found chat input textarea");

      // Type a discovery message
      const discoveryMessage = "I want to compare how different AI models approach writing a business plan for a tech startup. I'm interested in seeing different perspectives on market analysis, financial projections, and go-to-market strategy.";
      await chatInput.fill(discoveryMessage);
      await page.waitForTimeout(500);
      await screenshot(page, "e2e_05b_message_typed.png", "Message typed in discovery chat");

      // Send the message (press Enter or click send button)
      const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
      // Try pressing Enter
      await chatInput.press("Enter");
      console.log("  Sent message via Enter key");

      // Wait for response (the AI needs time to respond)
      console.log("  Waiting for AI response (up to 30 seconds)...");

      // Wait for a response message to appear - look for assistant messages
      try {
        // Wait for at least 2 message bubbles (user + assistant)
        await page.waitForFunction(
          () => {
            const messages = document.querySelectorAll('[class*="rounded-2xl"][class*="px-4"]');
            return messages.length >= 2;
          },
          { timeout: 30000 }
        );
        console.log("  AI response received!");
      } catch (e) {
        console.log(`  WARNING: Timeout waiting for AI response: ${e.message}`);
        // Check for error messages
        const errorMsg = page.locator('[class*="red"]');
        if (await errorMsg.isVisible()) {
          const errorText = await errorMsg.textContent();
          console.log(`  Error displayed: ${errorText}`);
        }
      }

      await page.waitForTimeout(2000);
      await screenshot(page, "e2e_06_discovery_chat_exchange.png", "Discovery chat with exchange");
    } else {
      console.log("  ERROR: Could not find chat input textarea");
      // Maybe we can click a suggested prompt instead
      const suggestedPrompts = page.locator('button:has-text("I need diverse opinions")');
      if (await suggestedPrompts.isVisible()) {
        console.log("  Clicking suggested prompt instead...");
        await suggestedPrompts.click();
        await page.waitForTimeout(15000); // Wait for response
        await screenshot(page, "e2e_06_discovery_chat_exchange.png", "Discovery chat via suggested prompt");
      }
    }

    // =========================================================================
    // STEP 6: Click "Continue to Configure"
    // =========================================================================
    console.log("\n--- Step 6: Click 'Continue to Configure' ---");

    const continueConfigBtn = page.locator('button:has-text("Continue to Configure")');
    if (await continueConfigBtn.isVisible()) {
      const isDisabledContinue = await continueConfigBtn.getAttribute("disabled");
      console.log(`  'Continue to Configure' button found. Disabled: ${isDisabledContinue}`);

      if (!isDisabledContinue) {
        await screenshot(page, "e2e_07_before_continue_click.png", "Just before clicking Continue to Configure");
        await continueConfigBtn.click();
        console.log("  Clicked 'Continue to Configure'");

        // Immediately capture the synthesis loading overlay
        await page.waitForTimeout(200);
        await screenshot(page, "e2e_08_synthesis_loading.png", "Synthesis loading overlay (if visible)");

        // Check for the loading overlay
        const loadingOverlay = page.locator('text=Synthesizing your discoveries');
        if (await loadingOverlay.isVisible()) {
          console.log("  PASS: Synthesis loading overlay is visible!");
          await screenshot(page, "e2e_08b_synthesis_loading_confirmed.png", "Confirmed synthesis loading overlay");
        } else {
          console.log("  INFO: Loading overlay may have already disappeared or not shown.");
        }

        // Wait for synthesis to complete (up to 15 seconds)
        console.log("  Waiting for synthesis to complete (up to 15 seconds)...");
        try {
          await page.waitForFunction(
            () => {
              const overlay = document.querySelector('[class*="Synthesizing"], [class*="synthesizing"]');
              if (!overlay) return true; // Already gone
              return overlay.closest('[style*="display: none"]') !== null;
            },
            { timeout: 15000 }
          );

          // Also wait for the loading text to disappear
          try {
            await page.waitForSelector('text=Synthesizing your discoveries', { state: 'hidden', timeout: 15000 });
          } catch (e) {
            // Already hidden
          }

          console.log("  Synthesis completed!");
        } catch (e) {
          console.log(`  WARNING: Timeout waiting for synthesis: ${e.message}`);
        }

        await page.waitForTimeout(2000);
        await screenshot(page, "e2e_09_configure_step.png", "Configure step after synthesis");
      } else {
        console.log("  ERROR: Continue to Configure button is disabled (no messages?)");
      }
    } else {
      console.log("  ERROR: 'Continue to Configure' button not found");
      // Check if there's a regular Continue button
      const regularContinue = page.locator('button:has-text("Continue")');
      if (await regularContinue.isVisible()) {
        console.log("  Found regular Continue button instead");
      }
    }

    // =========================================================================
    // STEP 7: Verify Configure Step with Pre-filled TaskInput
    // =========================================================================
    console.log("\n--- Step 7: Verify Configure Step ---");

    // Find the TaskInput textarea
    const taskInput = page.locator('textarea').first();
    if (await taskInput.isVisible()) {
      const taskValue = await taskInput.inputValue();
      console.log(`  TaskInput value (first 200 chars): "${taskValue.substring(0, 200)}"`);

      if (taskValue.trim().length > 0) {
        console.log("  PASS: TaskInput is pre-filled with synthesized content!");
        console.log(`  Full task text length: ${taskValue.length} characters`);
      } else {
        console.log("  FAIL: TaskInput is empty - synthesis may have failed");
      }

      // Check if Run Flow button is enabled
      const runFlowBtn = page.locator('button:has-text("Run Flow")');
      if (await runFlowBtn.isVisible()) {
        const isRunDisabled = await runFlowBtn.getAttribute("disabled");
        console.log(`  Run Flow button disabled: ${isRunDisabled}`);
        if (!isRunDisabled && taskValue.trim().length > 0) {
          console.log("  PASS: Run Flow button is enabled (task text present)");
        } else {
          console.log("  INFO: Run Flow button state - may need non-empty task");
        }
      }
    } else {
      console.log("  WARNING: TaskInput textarea not found on page");
    }

    await screenshot(page, "e2e_10_configure_final.png", "Final Configure step state");

    // =========================================================================
    // Final Summary
    // =========================================================================
    console.log("\n=== E2E Test Complete ===");
    console.log(`Screenshots saved to: ${ASSETS_DIR}`);

  } catch (error) {
    console.error("\n!!! TEST ERROR !!!");
    console.error(error);
    await screenshot(page, "e2e_ERROR.png", "Error state");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
