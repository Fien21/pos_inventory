import io
import sys
import csv
import gzip
import requests
import pandas as pd

# Safely set the maximum possible C-level field limit on Windows 64-bit
max_int = sys.maxsize
while True:
    try:
        csv.field_size_limit(max_int)
        break
    except OverflowError:
        max_int = int(max_int / 10)

CSV_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz"
OUTPUT_FILE = "philippines_products_master.xlsx"

print("Connecting to Open Food Facts live stream...")
print("Extracting Philippine products (prefix 480 or tagged 'philippines')...")

headers = {
    "User-Agent": "ShadowApolloPOS - PythonExtractor/1.0"
}

response = requests.get(CSV_URL, headers=headers, stream=True)
response.raise_for_status()

gzip_stream = gzip.GzipFile(fileobj=response.raw)
text_stream = io.TextIOWrapper(gzip_stream, encoding="utf-8", errors="replace")

reader = csv.DictReader(text_stream, delimiter="\t")

products = []
categories_set = set()
seen_barcodes = set()
count = 0

def save_excel():
    """Guarantees data is saved to Excel even if an error occurs."""
    if not products:
        print("No products collected to save.")
        return
    print(f"\nWriting {len(products):,} products to {OUTPUT_FILE}...")
    categories_df = pd.DataFrame({"Category Name": sorted(list(categories_set))})
    products_df = pd.DataFrame(products)

    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        categories_df.to_excel(writer, sheet_name="Categories", index=False)
        products_df.to_excel(writer, sheet_name="Products", index=False)
    print(f"SUCCESS: Saved {len(products):,} products to '{OUTPUT_FILE}'.")

try:
    while True:
        try:
            row = next(reader)
        except StopIteration:
            # End of stream reached
            break
        except Exception:
            # If any individual row still has corrupted bytes or weird delimiters, skip it
            continue

        count += 1
        if count % 100000 == 0:
            print(f"Scanned {count:,} items... Found {len(products)} Philippine products so far.")

        barcode = (row.get("code") or "").strip()
        name = (row.get("product_name") or row.get("product_name_en") or "").strip()
        countries = (row.get("countries_tags") or row.get("countries") or "").lower()

        is_ph = "philippines" in countries or barcode.startswith("480")

        if is_ph and barcode and name and barcode.isdigit() and barcode not in seen_barcodes:
            seen_barcodes.add(barcode)

            raw_category = (row.get("categories") or "General Grocery").split(",")[0].strip()
            category = raw_category.split(":")[-1].replace("-", " ").title() if ":" in raw_category else raw_category.title()
            if not category:
                category = "General Grocery"
            categories_set.add(category)

            brand = (row.get("brands") or "").strip()
            description = f"{brand} - {name}" if brand else name

            products.append({
                "Barcode": barcode,
                "Product Name": name,
                "Description": description,
                "Price": "",
                "Cost Price": "",
                "Retail Price": "",
                "Tax Rate": 12,
                "Tax Inclusive": "Yes",
                "Stock Quantity": "",
                "Category Name": category,
                "Serial Numbers": ""
            })

except KeyboardInterrupt:
    print("\nProcess interrupted by user.")
except Exception as e:
    print(f"\nStream ended or encountered: {e}")

# Always execute save before exiting
save_excel()