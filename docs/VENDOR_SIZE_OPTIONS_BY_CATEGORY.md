# Vendor listing — size options by category

When a vendor lists a product (product detail page → Select size → Enter Details), the size dropdown is filled from these options. Defined in `frontend/src/app/dashboard/product/[id]/page.tsx`.

---

## Table: sizes per category

| Category     | Size options (dropdown) |
|-------------|--------------------------|
| **Sneakers** | UK 2.5, UK 3, UK 3.5, UK 4, UK 4.5, UK 5, UK 5.5, UK 6, UK 6.5, UK 7, UK 7.5, UK 8, UK 8.5, UK 9, UK 9.5, UK 10, UK 10.5, UK 11, UK 11.5, UK 12, UK 12.5, UK 13 |
| **Apparel**  | XXS, XS, S, M, L, XL, XXL |
| **Perfumes** | OneSize |
| **Watches**  | OneSize |
| **Handbags** | OneSize |
| **Accessories** | OneSize |

---

## In code

- **Sneakers:** `UK 2.5` through `UK 13` in half steps (22 options).
- **Apparel:** `["XXS", "XS", "S", "M", "L", "XL", "XXL"]`.
- **All other categories:** `["OneSize"]`.

To change options later, edit `getSizesForCategory` and the constants `SNEAKER_SIZES`, `APPAREL_SIZES`, and `ONE_SIZE` in `frontend/src/app/dashboard/product/[id]/page.tsx`.
