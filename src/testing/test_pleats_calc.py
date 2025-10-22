import pandas as pd
from selenium import webdriver
import time
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import traceback
import logging
import os

# --- CONFIGURATION ---
APP_URL = "http://localhost:5173/"  # Adjust if your app runs on a different port

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_excel.csv")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_app.csv")
LOG_FILE_PATH = os.path.join(SCRIPT_DIR, "app_testing_logs.txt")

# --- LOCATORS ---
# Centralize element locators for easier maintenance
class Locators:
    APP_HEADER = (By.XPATH, "//h1[text()='NAT Pricing Calculator']")
    PLEATS_TAB_BUTTON = (By.XPATH, "//button[contains(text(), 'Pleats Calc')]")
    FAMILY_SELECT = (By.XPATH, "//label[text()='Product Family']/following-sibling::select")
    # Locators for Decimal Mode
    DECIMAL_MODE_TOGGLE = (By.XPATH, "//button[@aria-label='Toggle input mode']")
    DECIMAL_MODE_SPAN = (By.XPATH, "//span[text()='Decimal']")
    DECIMAL_WIDTH_INPUT = (By.XPATH, "//label[text()='Width (inches)']/following-sibling::input")
    DECIMAL_LENGTH_INPUT = (By.XPATH, "//label[text()='Length (inches)']/following-sibling::input")

    DEPTH_SELECT = (By.XPATH, "//label[text()='Depth (inches)']/following-sibling::select")
    
    @staticmethod
    def exact_radio(value):
        return (By.XPATH, f"//input[@name='isExact' and @value='{value}']")


def get_text_from_result(driver, label):
    """Safely gets text from a pricing result field."""
    logger = logging.getLogger()
    try:
        logger.info(f"      [CAPTURE] Getting result for '{label}'...")
        
        # Use the same approach that worked in the debug code
        # Find all flex divs and search through them
        all_result_divs = driver.find_elements(By.XPATH, "//div[contains(@class, 'flex') and contains(@class, 'justify-between')]")
        
        for div in all_result_divs:
            spans = div.find_elements(By.TAG_NAME, "span")
            if len(spans) >= 2:
                label_text = spans[0].text.strip()
                if label_text == f"{label}:":
                    value = spans[1].text.strip()
                    logger.info(f"         ... value is: '{value}'")
                    return value
        
        print(f"⚠️  Could not find result field for '{label}'")
        return "ERROR: NOT FOUND"
        
    except Exception as e:
        print(f"⚠️  Exception while getting '{label}': {e}")
        logger.error(f"      [CAPTURE] Exception while getting '{label}': {e}")
        return "ERROR: EXCEPTION"

def main():
    """
    Main function to run the automated test against the React app.
    """
    # --- 0. SETUP LOGGING ---
    # Overwrite the log file for each run
    if os.path.exists(LOG_FILE_PATH):
        os.remove(LOG_FILE_PATH)
        
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE_PATH),
            logging.StreamHandler() # Also print to console
        ]
    )
    logger = logging.getLogger()

    # --- 1. SETUP ---
    logger.info("🚀 Starting Pleats Calculator test automation...")
    chrome_options = webdriver.ChromeOptions()
    chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(APP_URL)

    # Wait for the main calculator template to be fully loaded.
    # We'll wait for the main app header, which is always present.
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(Locators.APP_HEADER)
        )
        logger.info("✅ Application loaded successfully.")
    except TimeoutException:
        logger.error("❌ Timed out waiting for the application to load. Is the dev server running?")
        driver.quit()
        return

    # --- CLICK THE CORRECT TAB ---
    # The app starts on the 'Dashboard' tab, we need to switch to the 'Pleats Calc'
    try:
        pleats_tab_button = driver.find_element(*Locators.PLEATS_TAB_BUTTON)
        pleats_tab_button.click()
        logger.info("✅ Switched to 'Pleats Calc' tab.")
    except Exception as e:
        logger.error(f"❌ Could not find or click the 'Pleats Calc' tab. Error: {e}")
        driver.quit()
        return
    
    # --- WAIT FOR CALC TO RENDER & SET INPUT MODE TO DECIMAL ---
    try:
        logger.info("   [SETUP] Waiting for calculator form to render...")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(Locators.FAMILY_SELECT)
        )
        logger.info("   [SETUP] Calculator rendered. Ensuring input mode is set to 'Decimal'...")
        decimal_span = driver.find_element(*Locators.DECIMAL_MODE_SPAN)
        # Check if the 'Decimal' span is not active (i.e., does not have the blue text color)
        if 'text-blue-600' not in decimal_span.get_attribute('class'):
            logger.info("      ... Mode is 'Fractional'. Clicking toggle to switch to 'Decimal'.")
            toggle = driver.find_element(*Locators.DECIMAL_MODE_TOGGLE)
            toggle.click()
            time.sleep(0.5) # Brief pause for UI to update
        logger.info("✅ Input mode is 'Decimal'.")
    except Exception as e:
        logger.error(f"❌ Could not set input mode to 'Decimal'. Error: {e}")
        driver.quit()
        return

    # --- 2. READ TEST DATA ---
    try:
        df_truth = pd.read_csv(INPUT_CSV_PATH)
        logger.info(f"✅ Found {len(df_truth)} test cases in '{INPUT_CSV_PATH}'.")
    except FileNotFoundError:
        logger.error(f"❌ Input file not found: '{INPUT_CSV_PATH}'. Please run pleats_excel.py first.")
        driver.quit()
        return

    app_results = []

    # --- 3. LOOP THROUGH TEST CASES ---
    for index, row in df_truth.iterrows():
        # Convert data to expected types to prevent errors
        width = float(row["Width"])
        length = float(row["Length"])
        depth = int(row["Depth"])
        exact = str(row["Exact"])
        family = str(row["Product_Family"]).strip()

        logger.info(f"--- Running Test Case #{index + 1} ---")
        logger.info(f"Inputs: W={width}, L={length}, D={depth}, Exact={exact}, Family='{family}'")

        try:
            # --- 4. SIMULATE INPUTS ---
            # First, get the current part number to see if it changes.
            logger.info("   [INFO] Capturing initial part number before input...")
            initial_part_number = get_text_from_result(driver, "Part Number")

            logger.info("   [STEP] Waiting for family select element...")
            family_select_el = WebDriverWait(driver, 1).until(
                EC.presence_of_element_located(Locators.FAMILY_SELECT)
            )
            logger.info(f"   [STEP] Selecting family: '{family}'")
            Select(family_select_el).select_by_visible_text(family)
            logger.info("      ... done.")

            # Width
            logger.info("   [STEP] Finding decimal width input...")
            width_input = driver.find_element(*Locators.DECIMAL_WIDTH_INPUT)
            logger.info("   [STEP] Clearing width input...")
            width_input.clear()
            logger.info(f"   [STEP] Sending keys for width: '{width}'")
            width_input.send_keys(str(width))
            width_input.send_keys(Keys.TAB)  # Simulate tabbing out to trigger onChange reliably
            logger.info("      ... done.")

            # Length
            logger.info("   [STEP] Finding decimal length input...")
            length_input = driver.find_element(*Locators.DECIMAL_LENGTH_INPUT)
            logger.info("   [STEP] Clearing length input...")
            length_input.clear()
            logger.info(f"   [STEP] Sending keys for length: '{length}'")
            length_input.send_keys(str(length))
            length_input.send_keys(Keys.TAB)  # Simulate tabbing out
            logger.info("      ... done.")

            # Depth
            logger.info("   [STEP] Finding depth select...")
            depth_select_el = driver.find_element(*Locators.DEPTH_SELECT)
            logger.info(f"   [STEP] Selecting depth by value: '{depth}'")
            Select(depth_select_el).select_by_value(str(depth))
            logger.info("      ... done.")

            # Made Exact
            exact_radio_value = "yes" if exact == "Yes" else "no"
            logger.info(f"   [STEP] Finding 'Made Exact' radio button with value: '{exact_radio_value}'")
            exact_radio = driver.find_element(*Locators.exact_radio(exact_radio_value))
            logger.info("   [STEP] Clicking 'Made Exact' radio button...")
            exact_radio.click()
            logger.info("      ... done.")

            # --- 5. CAPTURE OUTPUT ---
            logger.info(f"   [STEP] Waiting for Part Number to change from '{initial_part_number}'...")
            part_number_xpath = "//span[text()='Part Number:']/following-sibling::span"
            try:
                WebDriverWait(driver, 1).until(
                    lambda d: d.find_element(By.XPATH, part_number_xpath).text != initial_part_number
                )
            except TimeoutException:
                # This can happen if the inputs produce the exact same result as the previous run.
                # It's not necessarily an error, so we'll just log it and continue.
                logger.warning("      [INFO] Part number did not change after 1 second. Proceeding anyway.")
                # Add a small static wait just in case, to let other fields settle.
                time.sleep(0.25)
            logger.info("      ... Part Number updated.")

            part_number = get_text_from_result(driver, "Part Number")
            price = get_text_from_result(driver, "Price")
            carton_qty = get_text_from_result(driver, "Carton Quantity")
            carton_price = get_text_from_result(driver, "Carton Price")
            logger.info(f"   Captured Part Number: {part_number}")

            # --- 6. CAPTURE BROWSER LOGS ---
            logger.info("   [LOGS] Capturing browser console logs for this test case...")
            browser_logs = driver.get_log('browser')
            if browser_logs:
                for entry in browser_logs:
                    # Format the log message to be clean and readable
                    log_message = entry['message'].split(' ', 2)[-1].replace('\\n', '\n').replace('"', '')
                    logger.info(f"      [BROWSER] {log_message}")

        except Exception as e:
            logger.error(f"❌ An error occurred during test case #{index + 1}: {e}", exc_info=True)
            part_number, price, carton_qty, carton_price = "TEST_ERROR", "TEST_ERROR", "TEST_ERROR", "TEST_ERROR"
        
        app_results.append({
            "Part Number": part_number,
            "Price": price,
            "Carton Quantity": carton_qty,
            "Carton Price": carton_price,
        })

    # --- 7. SAVE RESULTS ---
    driver.quit()
    df_app_results = pd.DataFrame(app_results)
    df_app_results.to_csv(OUTPUT_CSV_PATH, index=False)
    logger.info(f"\n\n✅ Test complete. Results saved to '{OUTPUT_CSV_PATH}'. Full logs in '{LOG_FILE_PATH}'.")

if __name__ == "__main__":
    main()