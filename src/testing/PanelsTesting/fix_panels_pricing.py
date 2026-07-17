import pandas as pd
import xlwings as xw

csv_path = 'src/data/PanelsData/PanelsPricing.csv'
df = pd.read_csv(csv_path)

wb = xw.books['C&I Custom Calculators 2026.xlsm']
ws = wb.sheets['Pricing Logic Panels-Links']

# Read the contiguous block of 171 prices
# 031 is 42 rows, 050 is 43 rows, 054 is 43 rows, 056 is 43 rows
# Total 171 rows
excel_values = ws.range('G3:G173').value

# Ensure it's a flat list of floats
raw_prices = [float(v) for v in excel_values]

if len(raw_prices) != len(df):
    print(f"Error: Row count mismatch! Excel has {len(raw_prices)}, CSV has {len(df)}")
    exit(1)

# Update the standard prices
df['priceCustomStandard'] = raw_prices

# Update the Antimicrobial prices
# Type 31 gets '$-', others get round(price * 1.04, 2)
df['PriceCustomAt'] = df.apply(
    lambda row: '$-' if row['type'] == 31 else f"{round(row['priceCustomStandard'] * 1.04, 2):.2f}", 
    axis=1
)

# Save it back
df.to_csv(csv_path, index=False)
print("Successfully updated PanelsPricing.csv with raw prices from Excel!")
