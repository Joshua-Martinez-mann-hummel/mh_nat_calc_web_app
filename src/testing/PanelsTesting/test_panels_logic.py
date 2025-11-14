import pandas as pd
import subprocess
import json
import os
import logging
import math

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_panels_excel.csv")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_panels_app.csv")
LOGIC_RUNNER_PATH = os.path.join(SCRIPT_DIR, "run_panels_logic.js")
LOG_FILE_PATH = os.path.join(SCRIPT_DIR, "panels_logic_testing_logs.txt")

def main():
    """
    Main function to run automated tests against the compiled JS logic for Panels-Links.
    This script reads test cases from the Excel output and runs them through the Node.js logic runner.
    """
    # --- 0. SETUP LOGGING ---
    if os.path.exists(LOG_FILE_PATH):
        os.remove(LOG_FILE_PATH)

    logging.basicConfig(level=logging.DEBUG)
    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)
    console_handler.setFormatter(logging.Formatter('%(message)s'))

    logger = logging.getLogger()
    logger.handlers = [file_handler, console_handler]

    # --- 1. SETUP ---
    logger.info("🚀 Starting Panels-Links LOGIC test automation...")

    if not os.path.exists(LOGIC_RUNNER_PATH):
        logger.error(f"❌ Logic runner script not found at '{LOGIC_RUNNER_PATH}'.")
        return

    compiled_logic_path = os.path.join(SCRIPT_DIR, '..', '..', '..', 'dist', 'logic', 'panelsLogic.js')
    if not os.path.exists(compiled_logic_path):
        logger.error(f"❌ Compiled logic file not found at '{compiled_logic_path}'.")
        logger.error("   Please run 'npm run build:logic' first.")
        return

    # --- 2. READ TEST DATA ---
    try:
        df_truth = pd.read_csv(INPUT_CSV_PATH)
        logger.info(f"✅ Found {len(df_truth)} test cases in '{INPUT_CSV_PATH}'.")
    except FileNotFoundError:
        logger.error(f"❌ Input file not found: '{INPUT_CSV_PATH}'. Please run the Excel test first.")
        return

    app_results = []

    # --- 3. LOOP THROUGH TEST CASES ---
    total_cases = len(df_truth)
    for index, row in df_truth.iterrows():
        logger.warning(f"--- Running Test Case #{index + 1}/{total_cases} ---")

        # --- 4. PREPARE INPUT FOR NODE SCRIPT ---
        # The 'isExact' value from Excel is 'Yes'/'No', convert to boolean
        is_exact_bool = str(row["isExact"]).strip().lower() == 'yes'

        input_data = {
            "productFamily": str(row["productFamily"]).strip(),
            "addOn": str(row["addOn"]).strip(),
            "type": str(row["type"]).strip(),
            "numberOfPanels": int(row["numberOfPanels"]),
            "isExact": is_exact_bool,
            "heightWhole": int(row["heightWhole"]),
            "heightFraction": float(row["heightFraction"]),
            "widthWhole": int(row["widthWhole"]),
            "widthFraction": float(row["widthFraction"]),
        }
        logger.info(f"Inputs: {json.dumps(input_data)}")

        try:
            # --- 5. EXECUTE NODE SCRIPT ---
            process = subprocess.run(
                ['node', LOGIC_RUNNER_PATH],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                check=True,
                encoding='utf-8'
            )
            result = json.loads(process.stdout)
            # Capture and log the detailed step-by-step output from the JS logic
            logger.info(f"--- JS Logic Trace ---\n{process.stderr.strip()}")
            logger.info("   ✅ Logic executed successfully.")
            logger.info(f"      [CAPTURE] Part Number: '{result.get('partNumber')}'")
            logger.info(f"      [CAPTURE] Price: '{result.get('price')}'")
            logger.info(f"      [CAPTURE] Errors: '{result.get('errors')}'")

        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"❌ An error occurred during test case #{index + 1}: {e}", exc_info=True)
            stderr_output = e.stderr if hasattr(e, 'stderr') else 'N/A'
            logger.error(f"   Stderr: {stderr_output}")
            result = {"partNumber": "TEST_ERROR", "price": 0, "cartonQty": 0, "cartonPrice": 0, "rangeOfLinkWidth": "TEST_ERROR", "errors": [str(e), stderr_output]}

        app_results.append(result)

    # --- 6. SAVE RESULTS ---
    df_app_results = pd.DataFrame(app_results)
    df_app_results.to_csv(OUTPUT_CSV_PATH, index=False)
    logger.info(f"\n\n✅ Test complete. Results saved to '{OUTPUT_CSV_PATH}'. Full logs in '{LOG_FILE_PATH}'.")

if __name__ == "__main__":
    main()