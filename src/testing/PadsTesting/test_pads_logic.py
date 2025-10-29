import pandas as pd
import subprocess
import json
import os
import logging
import math

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pads_excel.csv")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pads_app.csv")
LOGIC_RUNNER_PATH = os.path.join(SCRIPT_DIR, "run_pads_logic.js")
LOG_FILE_PATH = os.path.join(SCRIPT_DIR, "pads_logic_testing_logs.txt")

def main():
    """
    Main function to run the automated test against the compiled JS logic for pads.
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
    logger.info("🚀 Starting Pads LOGIC test automation...")

    if not os.path.exists(LOGIC_RUNNER_PATH):
        logger.error(f"❌ Logic runner script not found at '{LOGIC_RUNNER_PATH}'.")
        return

    compiled_logic_path = os.path.join(SCRIPT_DIR, '..', '..', '..', 'dist', 'logic', 'padsLogic.js')
    if not os.path.exists(compiled_logic_path):
        logger.error(f"❌ Compiled logic file not found at '{compiled_logic_path}'.")
        logger.error("   Please run 'npm run build:logic' first.")
        return

    # --- 2. READ TEST DATA ---
    try:
        df_truth = pd.read_csv(INPUT_CSV_PATH)
        logger.info(f"✅ Found {len(df_truth)} test cases in '{INPUT_CSV_PATH}'.")
    except FileNotFoundError:
        logger.error(f"❌ Input file not found: '{INPUT_CSV_PATH}'. Please create this file with your test cases.")
        return

    app_results = []

    # --- 3. LOOP THROUGH TEST CASES ---
    total_cases = len(df_truth)
    for index, row in df_truth.iterrows():
        # Convert data to expected types
        width = float(row["Width"])
        length = float(row["Length"])
        product_name = str(row["ProductName"]).strip()
        option = str(row["Option"]).strip()

        width_whole = math.floor(width)
        width_fraction = round(width - width_whole, 3)

        length_whole = math.floor(length)
        length_fraction = round(length - length_whole, 3)

        logger.warning(f"--- Running Test Case #{index + 1}/{total_cases} ---")
        logger.info(f"Inputs: W={width}, L={length}, Prod='{product_name}', Opt='{option}'")

        # --- 4. PREPARE INPUT FOR NODE SCRIPT ---
        input_data = {
            "productName": product_name,
            "option": option,
            "widthWhole": width_whole,
            "widthFraction": width_fraction,
            "lengthWhole": length_whole,
            "lengthFraction": length_fraction
        }

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

            # Log the detailed debug output from the Node script's stderr
            if process.stderr:
                logger.info("      [DEBUG] Logic trace from Node.js:")
                logger.info(f"      {process.stderr.strip()}")

            logger.info("   ✅ Logic executed successfully.")
            logger.info(f"      [CAPTURE] Part Number: '{result.get('partNumber')}'")
            logger.info(f"      [CAPTURE] Price: '{result.get('Price')}'")
            logger.info(f"      [CAPTURE] Errors: '{result.get('errors')}'")
            logger.info(f"      [CAPTURE] Carton Qty: '{result.get('cartonQty')}'")

        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"❌ An error occurred during test case #{index + 1}: {e}", exc_info=True)
            logger.error(f"   Stderr: {e.stderr if hasattr(e, 'stderr') else 'N/A'}")
            result = {
                "partNumber": "TEST_ERROR", 
                "Price": "TEST_ERROR", 
                "cartonQty": "TEST_ERROR", 
                "cartonPrice": "TEST_ERROR",
                "errors": [str(e)]
            }

        app_results.append(result)

    # --- 6. SAVE RESULTS ---
    df_app_results = pd.DataFrame(app_results)[['partNumber', 'Price', 'cartonQty', 'cartonPrice']]
    df_app_results.to_csv(OUTPUT_CSV_PATH, index=False)
    logger.info(f"\n\n✅ Test complete. Results saved to '{OUTPUT_CSV_PATH}'. Full logs in '{LOG_FILE_PATH}'.")

if __name__ == "__main__":
    main()