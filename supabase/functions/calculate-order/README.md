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
  "fee": 70,
  "total": 2070,
  "feePct": 3.5
}
```

- The fee is 3.5% of subtotal (rounded), paid by the buyer.
- The total is what the buyer pays.
- Returns 404 if tier not found, 400 if parameters missing, and 409 when ticket sales are closed.
