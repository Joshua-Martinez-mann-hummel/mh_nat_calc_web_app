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
OUTPUT_CSV_PATH = os.path.join(SCRIPT_DIR, "results_sleeves_excel.csv")

SHEET_NAME = "Sleeves Calc" 

TEST_ALL_COMBINATIONS = False # Set to True to test all combinations, False for random sampling
NUM_TESTS_PER_COMBINATION = 250 # Number of random (Width, Length) whole number pairs to test per product family
SECONDS_PER_TEST_CASE = 0.4

DECIMAL_OPTIONS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
WIDTH_RANGE = (4, 34)
LENGTH_RANGE = (4, 121)

EXCEL_ERROR_STRINGS = [
    'Contact Customer Service',
    'dimensions out of range',
    'width is out of range',
    'length is out of range',
    '#N/A',
    '#VALUE!',
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

        product_names = get_dropdown_values(ws, "F8")
        print("📦 Product Names:", product_names)

        results = []
        test_cases = []

        if TEST_ALL_COMBINATIONS:
            print("\nGenerating all possible test case combinations in-memory...")
            width_whole_options = [int(v) for v in get_dropdown_values(ws, "F13") if v is not None]
            length_whole_options = [int(v) for v in get_dropdown_values(ws, "F14") if v is not None]
            width_fraction_options = DECIMAL_OPTIONS
            length_fraction_options = DECIMAL_OPTIONS

            for name in product_names:
                ws["F8"].value = name
                time.sleep(0.2)
                available_options = get_dropdown_values(ws, "F10")
                
                filtered_options = available_options
                if name != 'Tri-Dek #3 2-Ply Pre-Cut Sleeves' and 'Antimicrobial' in filtered_options:
                    filtered_options = [opt for opt in filtered_options if opt != 'Antimicrobial']

                combinations = itertools.product(
                    [name], filtered_options, width_whole_options, width_fraction_options, length_whole_options, length_fraction_options
                )
                for combo in combinations:
                    test_cases.append({
                        "name": combo[0], "option": combo[1],
                        "width_whole": combo[2], "width_dec": combo[3],
                        "length_whole": combo[4], "length_dec": combo[5],
                    })
        else:
            print("\nGenerating random test cases in-memory...")
            for name in product_names:
                ws["F8"].value = name
                time.sleep(0.2)  # Pause for dependent dropdown to update
                
                available_options = get_dropdown_values(ws, "F10")
                print(f"  - For '{name}', found options: {available_options}")

                # Set width and length ranges based on product name
                current_width_range = WIDTH_RANGE
                current_length_range = LENGTH_RANGE

                if name == 'Tri Dek #3 2-Ply Pre-Cut Sleeves':
                    current_width_range = (4, 60)
                    current_length_range = (4, 100)
                elif name == 'Wire Ring Frames for Pre-Cut Sleeves':
                    current_width_range = (3, 34)
                    current_length_range = (4, 77)

                filtered_options = available_options
                if name != 'Tri-Dek #3 2-Ply Pre-Cut Sleeves' and 'Antimicrobial' in filtered_options:
                    filtered_options = [opt for opt in filtered_options if opt != 'Antimicrobial']
                
                for option in filtered_options:
                    for _ in range(NUM_TESTS_PER_COMBINATION):
                        width_whole, width_dec = random_dimension(*current_width_range)
                        length_whole, length_dec = random_dimension(*current_length_range)
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
            ws["F8"].value = case["name"]
            ws["F10"].value = case["option"]
            ws["F13"].value = case["width_whole"]
            ws["G13"].value = case["width_dec"]
            ws["F14"].value = case["length_whole"]
            ws["G14"].value = case["length_dec"]

            wb.app.calculate()
            time.sleep(0.1)

            # Read Outputs
            try:
                part_number = ws["F16"].api.Text
                price_text = ws["F18"].api.Text
                carton_qty_text = ws["F22"].api.Text
                carton_price_text = ws["F23"].api.Text
                
                price = parse_excel_output_value(price_text)
                carton_qty = parse_excel_output_value(carton_qty_text)
                carton_price = parse_excel_output_value(carton_price_text)
                
            except Exception as e:
                print(f"\n   [DEBUG] Error reading text: {e}. Falling back to .value")
                part_number = ws["F17"].value or ""
                price = parse_excel_output_value(ws["F19"].value)
                carton_qty = parse_excel_output_value(ws["F21"].value)
                carton_price = parse_excel_output_value(ws["F22"].value)

            # Ensure we don't write NaN values to the CSV.
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