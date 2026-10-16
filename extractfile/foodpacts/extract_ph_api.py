import requests
import pandas as pd
import math

OUTPUT_FILE = "philippines_products_api.xlsx"
PAGE_SIZE = 1000
BASE_URL = "https://world.openfoodfacts.org/api/v2/search?countries_tags_en=philippines&fields=code,product_name,brands,categories,countries&page_size={}&page={}"

print("Connecting to Open Food Facts v2 API for Philippine products...")

headers = {
    "User-Agent": "ShadowApolloPOS - PythonExtractor/1.0"
}

# 1. Get the first page to see total count
response = requests.get(BASE_URL.format(PAGE_SIZE, 1), headers=headers)
response.raise_for_status()
data = response.json()

total_count = data.get("count", 0)
print(f"Total Philippine products found in database: {total_count:,}")

if total_count == 0:
    print("No products found.")
    exit()

total_pages = math.ceil(total_count / PAGE_SIZE)

products = []
categories_set = set()

def process_products(items):
    for row in items:
        barcode = (row.get("code") or "").strip()
        name = (row.get("product_name") or row.get("product_name_en") or "").strip()
        
        if barcode and name and barcode.isdigit():
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
                "Price": 20.00,
                "Cost Price": 16.00,
                "Retail Price": 20.00,
                "Tax Rate": 12,
                "Tax Inclusive": "Yes",
                "Stock Quantity": 24,
                "Category Name": category,
                "Serial Numbers": ""
            })

# Process first page
process_products(data.get("products", []))

# Loop through remaining pages
for page in range(2, total_pages + 1):
    print(f"Fetching page {page} of {total_pages}...")
    try:
        resp = requests.get(BASE_URL.format(PAGE_SIZE, page), headers=headers)
        resp.raise_for_status()
        page_data = resp.json()
        process_products(page_data.get("products", []))
    except Exception as e:
        print(f"Error fetching page {page}: {e}")
        print("Continuing with next page...")

print(f"\nExtraction completed! Processed {len(products):,} valid Philippine products.")

if products:
    print(f"Building Excel file: {OUTPUT_FILE}...")
    
    categories_df = pd.DataFrame({"Category Name": sorted(list(categories_set))})
    products_df = pd.DataFrame(products)

    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        categories_df.to_excel(writer, sheet_name="Categories", index=False)
        products_df.to_excel(writer, sheet_name="Products", index=False)

    print(f"SUCCESS: Saved {len(products):,} products to '{OUTPUT_FILE}'.")
else:
    print("No matching products found.")
