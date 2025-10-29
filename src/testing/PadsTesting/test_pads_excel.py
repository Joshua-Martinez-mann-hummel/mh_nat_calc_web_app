import xlwings as xw
import pandas as pd
import random
import itertools
import time
import os

# ----------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKBOOK_PATH = os.path.join(SCRIPT_DIR, '..', '..', '..', 'raw_calc.xlsm')
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_pads_excel.csv")

SHEET_NAME = "Pads Calc" 

TEST_ALL_COMBINATIONS = False # Set to True to test all combinations, False for random sampling
NUM_TESTS_PER_COMBINATION = 125  # Number of random (Width, Length) whole number pairs to test per product family
SECONDS_PER_TEST_CASE = 0.4

DECIMAL_OPTIONS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]

WIDTH_RANGES = {
    "Tri-Dek #3 Media Pad": (4, 70),
    "Tri-Dek #5 Media Pad": (4, 84),
    "Tri-Dek #7 Media Pad": (4, 96),
    "Tri-Dek #10 Media Pad": (4, 250),
    "Tri-Dek 2-Ply 15/40 Media Pad": (4, 250),
    "Tri-Dek 3-Ply 6/15/40 Media Pad": (4, 250),
    "Tri-Dek 3-Ply 15/40+3 Media Pad": (5, 250),
    "Tri-Dek 4-Ply 6/40+3 Media Pad": (5, 250),
    "Tri-Dek #8 MERV 8 Pads": (4, 78)
}

EXCEL_ERROR_STRINGS = [
    'Contact Customer Service',
    'dimensions out of range',
    'width is out of range',
    'length is out of range',
    '#N/A',
    '#VALUE!',
    'Call for Quote',
    'Discontinued',
    'Special Price'
]

# ----------------------------------------------------
# HELPERS
# ----------------------------------------------------
def get_dropdown_values(ws, cell_address):
    """Return list of dropdown options for a given cell."""
    rng = ws.range(cell_address)
    try:
        validation = rng.api.Validation
        if validation.Type != 3: return []
        formula = validation.Formula1
        if not formula or not str(formula).startswith("="):
            return [item.strip() for item in str(formula).split(",") if item.strip()]
        
        ref = formula[1:]
        if "!" in ref:
            sheet_name, range_ref = ref.split("!", 1)
            sheet_name = sheet_name.strip("'")
            target_ws = ws.book.sheets[sheet_name]
            return [cell.value for cell in target_ws.range(range_ref) if cell.value is not None]
        else:
            named_rng = ws.book.names[ref].refers_to_range
            return [cell.value for cell in named_rng if cell.value is not None]
    except Exception:
        return []

def random_dimension(range_min, range_max):
    whole = random.randint(range_min, range_max)
    decimal = random.choice(DECIMAL_OPTIONS)
    return whole, decimal

def parse_excel_output_value(text_value):
    """
    Parses an Excel output text value. If it's an error string, returns the string.
    Otherwise, attempts to convert to float, returning 0.0 on failure.
    """
    if isinstance(text_value, str):
        if any(err_str.lower() in text_value.lower() for err_str in EXCEL_ERROR_STRINGS) or text_value.startswith('#'):
            return text_value
        
        cleaned_value = text_value.replace('$', '').replace(',', '').strip()
        if cleaned_value == '': return 0.0
        try:
            return float(cleaned_value)
        except ValueError:
            return 0.0
    return text_value

# ----------------------------------------------------
# MAIN
# ----------------------------------------------------
def main():
    app = xw.App(visible=False)
    try:
        wb = xw.Book(WORKBOOK_PATH)
        ws = wb.sheets[SHEET_NAME]

        product_names = get_dropdown_values(ws, "F7")
        print("📦 Product Names:", product_names)

        results = []
        test_cases = []

        if TEST_ALL_COMBINATIONS:
            print("\nGenerating all possible test case combinations in-memory... (Not implemented for Pads)")
            # This part is complex and might not be needed. Sticking to random for now.
            pass
        else:
            print("\nGenerating random test cases in-memory...")
            for name in product_names:
                ws["F7"].value = name
                time.sleep(0.2)  # Pause for dependent dropdown to update
                
                available_options = get_dropdown_values(ws, "F9")
                print(f"  - For '{name}', found options: {available_options}")

                current_width_range = WIDTH_RANGES.get(name, (4, 72)) # Default to (4, 72) if not found
                
                for option in available_options:
                    for _ in range(NUM_TESTS_PER_COMBINATION):
                        width_whole, width_dec = random_dimension(*current_width_range)
                        length_whole, length_dec = random_dimension(4, 250) # Use a wide range for length
                        test_cases.append({
                            "name": name, "option": option,
                            "width_whole": width_whole, "width_dec": width_dec,
                            "length_whole": length_whole, "length_dec": length_dec,
                        })

        print(f"Generated {len(test_cases)} total test cases.")

        total_seconds = len(test_cases) * SECONDS_PER_TEST_CASE
        estimated_minutes = total_seconds / 60
        print(f"Estimated time to process in Excel: {estimated_minutes:.2f} minutes.")
        print("Processing test cases in Excel...")

        for i, case in enumerate(test_cases):
            print(f"  Processing case {i+1}/{len(test_cases)} for '{case['name']}'...", end='\r')
            
            # Populate Inputs
            ws["F7"].value = case["name"]
            ws["F9"].value = case["option"]
            ws["F12"].value = case["width_whole"]
            ws["G12"].value = case["width_dec"]
            ws["F13"].value = case["length_whole"]
            ws["G13"].value = case["length_dec"]

            wb.app.calculate()
            time.sleep(0.1)

            # Read Outputs
            try:
                part_number = ws["F15"].api.Text
                price_text = ws["F17"].api.Text
                carton_qty_text = ws["F21"].api.Text
                carton_price_text = ws["F22"].api.Text
                
                price = parse_excel_output_value(price_text)
                carton_qty = parse_excel_output_value(carton_qty_text)
                carton_price = parse_excel_output_value(carton_price_text)
                
            except Exception as e:
                print(f"\n   [DEBUG] Error reading text: {e}. Falling back to .value")
                part_number = ws["F15"].value or ""
                price = parse_excel_output_value(ws["F17"].value)
                carton_qty = parse_excel_output_value(ws["F21"].value)
                carton_price = parse_excel_output_value(ws["F22"].value)

            if isinstance(price, (int, float)): price = 0 if pd.isna(price) else price
            if isinstance(carton_qty, (int, float)): carton_qty = 0 if pd.isna(carton_qty) else carton_qty
            if isinstance(carton_price, (int, float)): carton_price = 0 if pd.isna(carton_price) else carton_price

            results.append({
                "ProductName": case["name"],
                "Option": case["option"],
                "Width": case["width_whole"] + case["width_dec"],
                "Length": case["length_whole"] + case["length_dec"],
                "Part_Number": part_number,
                "Price": price,
                "Carton_Qty": carton_qty,
                "Carton_Price": carton_price,
            })

        df = pd.DataFrame(results)
        df.to_csv(OUTPUT_CSV_PATH, index=False)
        print(f"\n✅ Test results saved to {OUTPUT_CSV_PATH}")

    finally:
        if 'wb' in locals(): wb.close()
        app.quit()
        print("\n")

if __name__ == "__main__":
    main()