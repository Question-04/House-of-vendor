# Handbag Vendor Handoff: SKU-Based Listings Contract

## Goal

Enable cross-source handbag price comparison using common SKU, so:

- Darveys-listed PDP can also show Coach/Karl/Karl Paris vendor price rows when SKU is common.
- Coach/Karl/Karl Paris PDP can also show Darveys comparison row when SKU is common.
- Vendor checkout continues to route to the selected vendor phone (example: `7065391592`) using inventory-level mapping.

## Required Vendor API Change

Implement/confirm `GET /api/listings` for handbags with SKU-first matching.

### Request

- Endpoint: `GET /api/listings`
- Query params:
  - required: `category` (`handbags`)
  - optional: `skuId`, `productId`, `size`

### Matching Rule (Handbags)

1. If `skuId` is present and valid, match by `skuId` first.
2. If `skuId` is missing, fallback to `productId`.
3. Apply size filter when `size` is provided.

This is mandatory because `productId` is source-specific, but `skuId` is shared across Darveys/Coach/Karl/Karl Paris for the same product.

## Vendor Response Contract

Return:

```json
{
  "success": true,
  "vendorListings": [
    {
      "vendorId": "7065391592",
      "vendorName": "House of Plutus",
      "price": 15999,
      "inventoryId": 330849,
      "size": "OneSize",
      "compareOnly": false,
      "quantityRemaining": 1,
      "sourceKey": "coach",
      "vendorLogoUrl": "https://..."
    }
  ]
}
```

Notes:

- `vendorId` must be vendor phone used for order routing.
- `inventoryId` must be returned for buyable listings.
- `price` is INR (rupees).
- If no listing is available, return `vendorListings: []`.

## Vendor Inventory Reminder (Important)

Vendor inventory must include and maintain `sku_id` for handbags.

- Same item across sources must map to the same normalized `sku_id`.
- Suggested normalization: uppercase + remove non-alphanumeric characters.
- Without correct `sku_id`, common-SKU compare rows cannot be shown correctly.

## Listing Eligibility Rules

Only include buyable rows when all are true:

- listing is live (`list_now`)
- not sold out
- quantity remaining > 0
- valid positive price

## Order Handoff (Already Wired On Main Site)

Main site already does this:

1. User selects a vendor compare row.
2. Main order stores `vendor_phone` and `vendor_inventory_id`.
3. After payment is `PAID`, main backend calls:
   - `POST /api/orders/create-from-main`
4. Payload includes:
   - `vendorPhone`, `inventoryId`, `productId`, `category`, `size`, `externalOrderId`, shipping and product details.

So if selected listing has `vendorId = 7065391592`, order is automatically sent to that vendor.

## Vendor Completion Checklist

- [ ] `GET /api/listings` accepts `skuId` and applies SKU-first lookup for handbags.
- [ ] Fallback to `productId` works when `skuId` is absent.
- [ ] Response includes `vendorId`, `inventoryId`, `price`, `size` for buyable rows.
- [ ] Handbag inventory stores consistent normalized `sku_id`.
- [ ] Common SKU test passes:
  - Darveys SKU page returns non-Darveys vendor offer rows when same SKU exists.
  - Coach/Karl SKU page can return Darveys comparison row when same SKU exists.
- [ ] `POST /api/orders/create-from-main` still works with selected `vendorPhone` + `inventoryId`.

