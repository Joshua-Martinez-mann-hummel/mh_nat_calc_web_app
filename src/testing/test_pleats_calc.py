import pandas as pd
from selenium import webdriver
import time
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import traceback
import os

# --- CONFIGURATION ---
APP_URL = "http://localhost:5173/"  # Adjust if your app runs on a different port

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_excel.csv")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "my_results_pleats.csv")

# --- LOCATORS ---
# Centralize element locators for easier maintenance
class Locators:
    APP_HEADER = (By.XPATH, "//h1[text()='NAT Pricing Calculator']")
    PLEATS_TAB_BUTTON = (By.XPATH, "//button[contains(text(), 'Pleats Calc')]")
    FAMILY_SELECT = (By.XPATH, "//label[text()='Product Family']/following-sibling::select")
    WIDTH_INPUT = (By.XPATH, "//label[text()='Width (inches)']/following-sibling::input")
    LENGTH_INPUT = (By.XPATH, "//label[text()='Length (inches)']/following-sibling::input")
    DEPTH_SELECT = (By.XPATH, "//label[text()='Depth (inches)']/following-sibling::select")
    
    @staticmethod
    def exact_radio(value):
        return (By.XPATH, f"//input[@name='isExact' and @value='{value}']")


def get_text_from_result(driver, label):
    """Safely gets text from a pricing result field."""
    try:
        print(f"      [CAPTURE] Getting result for '{label}'...")
        
        # Use the same approach that worked in the debug code
        # Find all flex divs and search through them
        all_result_divs = driver.find_elements(By.XPATH, "//div[contains(@class, 'flex') and contains(@class, 'justify-between')]")
        
        for div in all_result_divs:
            spans = div.find_elements(By.TAG_NAME, "span")
            if len(spans) >= 2:
                label_text = spans[0].text.strip()
                if label_text == f"{label}:":
                    value = spans[1].text.strip()
                    print(f"         ... value is: '{value}'")
                    return value
        
        print(f"⚠️  Could not find result field for '{label}'")
        return "ERROR: NOT FOUND"
        
    except Exception as e:
        print(f"⚠️  Exception while getting '{label}': {e}")
        return "ERROR: EXCEPTION"

def main():
    """
    Main function to run the automated test against the React app.
    """
    # --- 1. SETUP ---
    print("🚀 Starting Pleats Calculator test automation...")
    driver = webdriver.Chrome()
    driver.get(APP_URL)

    # Wait for the main calculator template to be visible
    # We'll wait for the main app header, which is always present.
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(Locators.APP_HEADER)
        )
        print("✅ Application loaded successfully.")
    except TimeoutException:
        print("❌ Timed out waiting for the application to load. Is the dev server running?")
        driver.quit()
        return

    # --- CLICK THE CORRECT TAB ---
    # The app starts on the 'Dashboard' tab, we need to switch to the 'Pleats Calc'
    try:
        pleats_tab_button = driver.find_element(*Locators.PLEATS_TAB_BUTTON)
        pleats_tab_button.click()
        print("✅ Switched to 'Pleats Calc' tab.")
    except Exception as e:
        print(f"❌ Could not find or click the 'Pleats Calc' tab. Error: {e}")
        driver.quit()
        return

    # --- 2. READ TEST DATA ---
    try:
        df_truth = pd.read_csv(INPUT_CSV_PATH)
        print(f"✅ Found {len(df_truth)} test cases in '{INPUT_CSV_PATH}'.")
    except FileNotFoundError:
        print(f"❌ Input file not found: '{INPUT_CSV_PATH}'. Please run pleats_excel.py first.")
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

        print(f"\n--- Running Test Case #{index + 1} ---")
        print(f"Inputs: W={width}, L={length}, D={depth}, Exact={exact}, Family={family}")

        try:
            # --- 4. SIMULATE INPUTS ---
            # First, get the current part number to see if it changes.
            print("   [INFO] Capturing initial part number before input...")
            initial_part_number = get_text_from_result(driver, "Part Number")

            print("   [STEP] Waiting for family select element...")
            family_select_el = WebDriverWait(driver, 1).until(
                EC.presence_of_element_located(Locators.FAMILY_SELECT)
            )
            print(f"   [STEP] Selecting family: '{family}'")
            Select(family_select_el).select_by_visible_text(family)
            print("      ... done.")

            # Width
            print("   [STEP] Finding width input...")
            width_input = driver.find_element(*Locators.WIDTH_INPUT)
            print("   [STEP] Clearing width input...")
            width_input.clear()
            print(f"   [STEP] Sending keys for width: '{width}'")
            width_input.send_keys(str(width))
            width_input.send_keys(Keys.TAB) # Simulate tabbing out to trigger onChange reliably
            print("      ... done.")

            # Length
            print("   [STEP] Finding length input...")
            length_input = driver.find_element(*Locators.LENGTH_INPUT)
            print("   [STEP] Clearing length input...")
            length_input.clear()
            print(f"   [STEP] Sending keys for length: '{length}'")
            length_input.send_keys(str(length))
            length_input.send_keys(Keys.TAB) # Simulate tabbing out
            print("      ... done.")

            # Depth
            print("   [STEP] Finding depth select...")
            depth_select_el = driver.find_element(*Locators.DEPTH_SELECT)
            print(f"   [STEP] Selecting depth by value: '{depth}'")
            Select(depth_select_el).select_by_value(str(depth))
            print("      ... done.")

            # Made Exact
            exact_radio_value = "yes" if exact == "Yes" else "no"
            print(f"   [STEP] Finding 'Made Exact' radio button with value: '{exact_radio_value}'")
            exact_radio = driver.find_element(*Locators.exact_radio(exact_radio_value))
            print("   [STEP] Clicking 'Made Exact' radio button...")
            exact_radio.click()
            print("      ... done.")


            ##print("   [DEBUG] Page source around results:")
            ##print(driver.page_source)  # This will show you the HTML
            # Add this debug code right after the "Made Exact" click
            print("\n[DEBUG] Searching for all spans with result labels...")
            all_result_divs = driver.find_elements(By.XPATH, "//div[contains(@class, 'flex') and contains(@class, 'justify-between')]")
            for div in all_result_divs:
                spans = div.find_elements(By.TAG_NAME, "span")
                if len(spans) >= 2:
                    print(f"Found: '{spans[0].text}' -> '{spans[1].text}'")

            # --- 5. CAPTURE OUTPUT ---
            print(f"   [STEP] Waiting for Part Number to change from '{initial_part_number}'...")
            part_number_xpath = "//span[text()='Part Number:']/following-sibling::span"
            try:
                WebDriverWait(driver, 1).until(
                    lambda d: d.find_element(By.XPATH, part_number_xpath).text != initial_part_number
                )
            except TimeoutException:
                # This can happen if the inputs produce the exact same result as the previous run.
                # It's not necessarily an error, so we'll just log it and continue.
                print("      [INFO] Part number did not change after 5 seconds. Proceeding anyway.")
                # Add a small static wait just in case, to let other fields settle.
                time.sleep(0.25)
            print("      ... Part Number updated.")

            part_number = get_text_from_result(driver, "Part Number")
            price = get_text_from_result(driver, "Price")
            carton_qty = get_text_from_result(driver, "Carton Quantity")
            carton_price = get_text_from_result(driver, "Carton Price")
            print(f"   Captured Part Number: {part_number}")

        except Exception as e:
            traceback.print_exc()
            print(f"❌ An error occurred during test case #{index + 1}: {e}")
            part_number, price, carton_qty, carton_price = "TEST_ERROR", "TEST_ERROR", "TEST_ERROR", "TEST_ERROR"
        
        app_results.append({
            "Part Number": part_number,
            "Price": price,
            "Carton Quantity": carton_qty,
            "Carton Price": carton_price,
        })

    # --- 6. SAVE RESULTS ---
    driver.quit()
    df_app_results = pd.DataFrame(app_results)
    df_app_results.to_csv(OUTPUT_CSV_PATH, index=False)
    print(f"\n\n✅ Test complete. Results saved to '{OUTPUT_CSV_PATH}'.")

if __name__ == "__main__":
    main()