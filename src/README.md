# Routewise

Routewise is a small FastAPI app for watching affordable, nonstop flights from
Kansas City to airports serving Port St. Lucie.

## Run locally

```text
pip install -r requirements.txt
uvicorn src.app:app --reload
```

The UI is available at `http://localhost:8000/`. Live searches use SerpApi's
Google Flights endpoint only when `SERPAPI_KEY` is present in the server
environment:

```text
SERPAPI_KEY=your-key-here uvicorn src.app:app --reload
```

Do not put the key in the frontend, source files, or a committed `.env` file.
Without the key, or when SerpApi returns an error/no results, the UI clearly
shows the existing sample cards instead of presenting them as live fares.

## Live search behavior

`POST /api/flights/search` translates the form to SerpApi parameters:

- `MCI` is the departure airport; `FLL,MIA,PBI` represent the Port St. Lucie
  search area.
- Travelers map to `adults`, nonstop maps to `stops=1`, and excluded airline
  codes (when supplied) map to `exclude_airlines`.
- Each outbound date in the selected window is queried separately because the
  provider accepts one `outbound_date` per request.
- The arrival deadline and return-after time become hourly SerpApi ranges.
  SerpApi does not support minute-precise deadlines, so those constraints are
  approximate. Results are sorted by price and include a Google Flights
  booking/search link.
