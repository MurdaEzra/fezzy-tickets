# Calculate Order Supabase Edge Function

This function calculates ticket pricing and fees for an event order. It expects a POST request with JSON body:

```
{
  "eventId": "...",
  "tierId": "...",
  "quantity": 1
}
```

Returns:
```
{
  "price": 1000,
  "subtotal": 2000,
  "fee": 100,
  "total": 2000
}
```

- The fee is 5% of subtotal (rounded), paid by the organizer.
- The total is what the buyer pays (fee not added).
- Returns 404 if tier not found, 400 if parameters missing.
