import pandas as pd
import os
import numpy as np

# --- CONFIGURATION ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_RESULTS_PATH = os.path.join(SCRIPT_DIR, "results_panels_excel.csv")
APP_RESULTS_PATH = os.path.join(SCRIPT_DIR, "results_panels_app.csv")
SUMMARY_CSV_PATH = os.path.join(SCRIPT_DIR, "comparison_summary.csv")

# Define strings that are considered "error" or "non-price" values in the Excel sheet.
EXCEL_ERROR_STRINGS = [
    '#N/A',
    '#VALUE!',
    'Contact Customer Service',
    'Standard Part #',
    'N/A - Exceeds max link width',
    'Antimicrobial not available for this custom size.',
    'Custom price not found for these dimensions.'
]

def clean_df(df):
    """Cleans the DataFrame from both Excel and App results."""
    # Clean and convert currency/numeric columns
    for col in ["price", "cartonQty", "cartonPrice"]:
        if col in df.columns:
            # Convert to string, remove '$', ',', and handle non-numeric gracefully
            df[col] = df[col].astype(str).str.replace(r'[$,]', '', regex=True)
            # Convert to numeric, coercing errors to NaN (Not a Number)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    return df

def main():
    """
    Compares the results from the Excel calculator and the web app,
    then generates a report of any discrepancies.
    """
    print("🔍 Starting comparison for Panels-Links...")

    try:
        df_excel = pd.read_csv(EXCEL_RESULTS_PATH)
        df_app = pd.read_csv(APP_RESULTS_PATH)
    except FileNotFoundError as e:
        print(f"❌ Error: Could not find a results file. {e}")
        print("   Please run `test_panels_excel.py` and `test_panels_logic.py` first.")
        return

    if len(df_excel) != len(df_app):
        print(f"⚠️ Warning: The two CSV files have a different number of rows (Excel: {len(df_excel)}, App: {len(df_app)}). Comparison may be misaligned.")

    # --- 1. Clean Data ---
    df_excel_clean = clean_df(df_excel.copy())
    df_app_clean = clean_df(df_app.copy())

    # --- 2. Compare DataFrames ---
    summary_data = []

    for i in range(len(df_excel)):
        # Get original values for reporting
        excel_row = df_excel.loc[i]
        app_row = df_app.loc[i]

        # Get cleaned numeric values for comparison
        excel_row_clean = df_excel_clean.loc[i]
        app_row_clean = df_app_clean.loc[i]

        # --- Perform comparisons ---
        # Part Number: Match if identical, or if Excel shows 'FALSE' and the app shows 'N/A'.
        excel_pn = str(excel_row["partNumber"]).strip()
        app_pn = str(app_row["partNumber"]).strip()
        is_invalid_part = excel_pn.upper() == 'FALSE'
        pn_match = (excel_pn == app_pn) or \
                   (is_invalid_part and (app_pn.upper() == 'N/A' or app_pn == '' or app_pn.lower() == 'nan'))


        # Price: Match if they are numerically close, or if both are error states.
        # Match if they are numerically close, OR if both are non-numeric (NaN after cleaning).
        excel_p, app_p = excel_row_clean["price"], app_row_clean["price"]
        price_match = (np.isclose(excel_p, app_p)) or \
                      (pd.isna(excel_p) and pd.isna(app_p)) or \
                      ((excel_p == 0) and pd.isna(app_p)) or \
                      (pd.isna(excel_p) and (app_p == 0))

        # Carton Qty: Match if numerically close, or if both are error states,
        # OR if the part is invalid and the part number/price already match.
        excel_cq, app_cq = excel_row_clean["cartonQty"], app_row_clean["cartonQty"]
        cq_match = (np.isclose(excel_cq, app_cq)) or \
                   (pd.isna(excel_cq) and pd.isna(app_cq)) or \
                   ((excel_cq == 0) and pd.isna(app_cq)) or \
                   (pd.isna(excel_cq) and (app_cq == 0)) or \
                   (is_invalid_part and pn_match and price_match)

        # Carton Price: Match if numerically close, or if both are error states.
        excel_cp, app_cp = excel_row_clean["cartonPrice"], app_row_clean["cartonPrice"]
        cp_match = (np.isclose(excel_cp, app_cp)) or \
                   (pd.isna(excel_cp) and pd.isna(app_cp)) or \
                   ((excel_cp == 0) and pd.isna(app_cp)) or \
                   (pd.isna(excel_cp) and (app_cp == 0)) or \
                   (is_invalid_part and pn_match and price_match)

        # Range of Link Width: Match if identical strings.
        link_match = str(excel_row["rangeOfLinkWidth"]).strip() == str(app_row["rangeOfLinkWidth"]).strip()

        # Overall match is true only if all individual comparisons pass.
        overall_match = all([pn_match, price_match, cq_match, cp_match, link_match])

        # --- Assemble the summary row for every test case ---
        row_data = {
            # Inputs
            "productFamily": excel_row["productFamily"],
            "addOn": excel_row["addOn"],
            "type": excel_row["type"],
            "isExact": excel_row["isExact"],
            "height": excel_row["heightWhole"] + excel_row["heightFraction"],
            "width": excel_row["widthWhole"] + excel_row["widthFraction"],
            "numberOfPanels": excel_row["numberOfPanels"],
            # Outputs and Matches
            "excel_partNumber": excel_row["partNumber"],
            "app_partNumber": app_row["partNumber"],
            "partNumber_match": pn_match,
            "excel_price": excel_row["price"],
            "app_price": app_row["price"],
            "price_match": price_match,
            "excel_cartonQty": excel_row["cartonQty"],
            "app_cartonQty": app_row["cartonQty"],
            "cartonQty_match": cq_match,
            "excel_cartonPrice": excel_row["cartonPrice"],
            "app_cartonPrice": app_row["cartonPrice"],
            "cartonPrice_match": cp_match,
            "excel_linkWidth": excel_row["rangeOfLinkWidth"],
            "app_linkWidth": app_row["rangeOfLinkWidth"],
            "linkWidth_match": link_match,
            "overall_match": overall_match
        }
        summary_data.append(row_data)

    # --- 3. Generate Report ---
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_csv(SUMMARY_CSV_PATH, index=False)
    
    num_mismatches = len(summary_df[summary_df['overall_match'] == False])
    total_tests = len(df_excel)

    if num_mismatches == 0:
        print(f"\n✅ All {total_tests} tests passed! No discrepancies found.")
        print(f"   A full report of all test cases has been saved to '{SUMMARY_CSV_PATH}'.")
    else:
        print(f"\n🚨 Found {num_mismatches} mismatches out of {total_tests} tests.")
        print(f"   See '{SUMMARY_CSV_PATH}' for a detailed breakdown of all test results.")

if __name__ == "__main__":
    main()