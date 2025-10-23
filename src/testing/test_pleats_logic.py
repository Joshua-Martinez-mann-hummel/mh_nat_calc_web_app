import pandas as pd
import subprocess
import json
import os
import logging

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_excel.csv")
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pleats_app.csv")
LOGIC_RUNNER_PATH = os.path.join(SCRIPT_DIR, "run_pleat_logic.js")
LOG_FILE_PATH = os.path.join(SCRIPT_DIR, "logic_testing_logs.txt")

def main():
    """
    Main function to run the automated test against the compiled JS logic.
    """
    # --- 0. SETUP LOGGING ---
    if os.path.exists(LOG_FILE_PATH):
        os.remove(LOG_FILE_PATH)

    # Configure root logger to be permissive
    logging.basicConfig(level=logging.DEBUG)

    # Create a handler for file logging (detailed)
    file_handler = logging.FileHandler(LOG_FILE_PATH, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

    # Create a handler for console logging (less verbose)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING) # Only show warnings and errors on console
    console_handler.setFormatter(logging.Formatter('%(message)s'))

    logger = logging.getLogger()
    logger.handlers = [file_handler, console_handler] # Replace existing handlers

    # --- 1. SETUP ---
    logger.info("🚀 Starting Pleats LOGIC test automation...")

    # Check if the logic runner script exists
    if not os.path.exists(LOGIC_RUNNER_PATH):
        logger.error(f"❌ Logic runner script not found at '{LOGIC_RUNNER_PATH}'.")
        logger.error("   Please ensure 'run_pleat_logic.js' is in the same directory.")
        return

    # Check if the compiled logic file exists, which is a dependency for the runner
    compiled_logic_path = os.path.join(SCRIPT_DIR, '..', '..', 'dist', 'logic', 'pleatLogic.js')
    if not os.path.exists(compiled_logic_path):
        logger.error(f"❌ Compiled logic file not found at '{compiled_logic_path}'.")
        logger.error("   Please run 'npm run build:logic' first.")
        return

    # --- 2. READ TEST DATA ---
    try:
        df_truth = pd.read_csv(INPUT_CSV_PATH)
        logger.info(f"✅ Found {len(df_truth)} test cases in '{INPUT_CSV_PATH}'.")
    except FileNotFoundError:
        logger.error(f"❌ Input file not found: '{INPUT_CSV_PATH}'. Please run the excel test first.")
        return

    app_results = []

    # --- 3. LOOP THROUGH TEST CASES ---
    total_cases = len(df_truth)
    for index, row in df_truth.iterrows():
        # Convert data to expected types
        width = float(row["Width"])
        length = float(row["Length"])
        depth = int(row["Depth"])
        is_exact = str(row["Exact"]).lower() == "yes"
        family = str(row["Product_Family"]).strip()

        width_whole = int(width)
        width_fraction = width - width_whole

        length_whole = int(length)
        length_fraction = length - length_whole

        # Use a higher-level log for console progress that will be filtered by the console handler
        logger.warning(f"--- Running Test Case #{index + 1}/{total_cases} ---")
        logger.info(f"Inputs: W={width}, L={length}, D={depth}, Exact={is_exact}, Family='{family}'")

        # --- 4. PREPARE INPUT FOR NODE SCRIPT ---
        input_data = {
            "productFamily": family,
            "widthWhole": width_whole,
            "widthFraction": width_fraction,
            "lengthWhole": length_whole,
            "lengthFraction": length_fraction,
            "depth": depth,
            "isExact": is_exact
        }

        try:
            # --- 5. EXECUTE NODE SCRIPT ---
            process = subprocess.run(
                ['node', LOGIC_RUNNER_PATH],
                input=json.dumps(input_data),
                text=True,
                capture_output=True,
                check=True
            )
            result = json.loads(process.stdout)
            logger.info("   ✅ Logic executed successfully.")

            # --- 5a. CAPTURE OUTPUT (mimicking selenium test logs) ---
            logger.info("      [CAPTURE] Getting result for 'Part Number'...")
            logger.info(f"         ... value is: '{result.get('Part Number')}'")
            logger.info("      [CAPTURE] Getting result for 'Price'...")
            logger.info(f"         ... value is: '{result.get('Price')}'")
            logger.info("      [CAPTURE] Getting result for 'Carton Quantity'...")
            logger.info(f"         ... value is: '{result.get('Carton Quantity')}'")
            logger.info("      [CAPTURE] Getting result for 'Carton Price'...")
            logger.info(f"         ... value is: '{result.get('Carton Price')}'")

            # --- 5b. LOG DEBUG INFO ---
            debug_info = result.get('Debug Info', {})
            if debug_info:
                logger.info("      [DEBUG] Part Number Generation:")
                for key, value in debug_info.get('partNumberGeneration', {}).items():
                    logger.info(f"         ... {key}: {value}")
                
                logger.info("      [DEBUG] Price Calculation:")
                for key, value in debug_info.get('priceCalculation', {}).items():
                    logger.info(f"         ... {key}: {value}")

        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"❌ An error occurred during test case #{index + 1}: {e}", exc_info=True)
            logger.error(f"   Stderr: {e.stderr if hasattr(e, 'stderr') else 'N/A'}")
            result = {"Part Number": "TEST_ERROR", "Price": "TEST_ERROR", "Carton Quantity": "TEST_ERROR", "Carton Price": "TEST_ERROR"} # Ensure result is defined

        app_results.append(result)

    # --- 6. SAVE RESULTS ---
    df_app_results = pd.DataFrame(app_results)
    df_app_results.to_csv(OUTPUT_CSV_PATH, index=False)
    logger.info(f"\n\n✅ Test complete. Results saved to '{OUTPUT_CSV_PATH}'. Full logs in '{LOG_FILE_PATH}'.")

if __name__ == "__main__":
    main()