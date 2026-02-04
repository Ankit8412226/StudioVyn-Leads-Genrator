# Location Search Issue - Troubleshooting Guide

## Problem
Sometimes when searching for "Dubai" (or "subai" with a typo), Google Maps redirects to "Delhi" instead.

## Root Causes

### 1. **Typos in Search Query**
- If you type "subai" instead of "Dubai", Google Maps may autocorrect it
- Google's autocorrection algorithm might interpret it as "Delhi" based on:
  - Your IP location (if you're in India)
  - Search history
  - Common search patterns

### 2. **Geolocation-Based Suggestions**
- Google Maps uses your IP address to suggest nearby locations
- If your server/computer is in India, Google might prioritize Indian cities
- This is especially true for ambiguous or misspelled queries

### 3. **Search Query Ambiguity**
- Generic queries without country context can be misinterpreted
- Example: "restaurants in Dubai" might be redirected if Google thinks you meant a local area

## Solutions Implemented

### ✅ 1. Location Verification
The scraper now:
- Logs the requested location vs. actual URL location
- Warns you if Google Maps redirected to a different location
- Shows the exact search term in the console

**Console Output Example:**
```
🔍 Searching for: "restaurants" in "Dubai"
🔍 Navigating to: https://www.google.com/maps/search/restaurants%20in%20Dubai
📍 Current URL after navigation: https://www.google.com/maps/search/restaurants+in+Delhi
⚠️ WARNING: Requested location "Dubai" but URL shows "restaurants in Delhi"
⚠️ Google Maps may have redirected to a different location!
```

### ✅ 2. City Extraction from Address
- Now extracts the actual city from each business's address
- Verifies the location matches what you requested
- Logs the city for each scraped lead

**Console Output Example:**
```
✅ 1/30: Burj Khalifa Restaurant
   📍 City: Dubai
   📞 Phone: +971-4-123-4567
```

### ✅ 3. Better Search Query Construction
- Uses more explicit search formatting
- Properly encodes special characters
- Maintains the exact location you specify

## Best Practices to Avoid This Issue

### 1. **Use Correct Spelling**
❌ Bad: `"subai"`, `"dubi"`, `"dubay"`
✅ Good: `"Dubai"`

### 2. **Add Country Context**
❌ Less specific: `"Dubai"`
✅ More specific: `"Dubai, UAE"` or `"Dubai, United Arab Emirates"`

### 3. **Use Full Location Names**
❌ Ambiguous: `"restaurants in Dubai"`
✅ Clear: `"restaurants in Dubai, United Arab Emirates"`

### 4. **Check Console Logs**
Always review the console output after starting a scrape:
- Look for the `📍 Current URL after navigation` log
- Check for `⚠️ WARNING` messages about location mismatches
- Verify the `📍 City` field for each scraped lead

### 5. **Monitor the First Few Results**
- Check if the addresses match your expected location
- If you see wrong cities in the first 2-3 results, stop the scrape
- Adjust your search query and try again

## Example API Requests

### ❌ Prone to Errors
```json
{
  "query": "restaurants",
  "location": "subai",
  "limit": 30
}
```

### ✅ Recommended
```json
{
  "query": "restaurants",
  "location": "Dubai, UAE",
  "limit": 30
}
```

### ✅ Even Better
```json
{
  "query": "luxury restaurants",
  "location": "Dubai, United Arab Emirates",
  "limit": 30
}
```

## Debugging Steps

If you're getting wrong locations:

1. **Check the console logs** for location warnings
2. **Verify your spelling** of the location name
3. **Add country context** to the location (e.g., "Dubai, UAE")
4. **Try a more specific query** (e.g., "restaurants in Downtown Dubai, UAE")
5. **Check the first few scraped addresses** to confirm they're in the right city
6. **Use coordinates** if available (future enhancement)

## Technical Details

### Location Verification Code
The scraper now checks:
```typescript
// Extract location from URL to verify
const urlLocationMatch = currentUrl.match(/\/search\/([^/@]+)/);
if (urlLocationMatch) {
  const urlSearchTerm = decodeURIComponent(urlLocationMatch[1]);

  // Warn if mismatch
  if (location && !urlSearchTerm.toLowerCase().includes(location.toLowerCase())) {
    console.warn(`⚠️ WARNING: Requested "${location}" but got "${urlSearchTerm}"`);
  }
}
```

### City Extraction Code
```typescript
// Extract city from address
if (details.address) {
  const addressParts = details.address.split(',').map(p => p.trim());
  extractedCity = addressParts[addressParts.length - 3] ||
                  addressParts[addressParts.length - 2] ||
                  location;
}
```

## Future Enhancements

Potential improvements to make location search even more reliable:

1. **Coordinate-based search**: Use lat/lng instead of text
2. **Location validation API**: Verify location before scraping
3. **Auto-correction detection**: Detect and reject autocorrected queries
4. **Location confidence score**: Rate how confident we are in the location match
5. **Multiple location formats**: Try different formats if first attempt fails

## Summary

**The main issue**: Typos like "subai" → Google autocorrects to "Delhi"

**The fix**:
- ✅ Location verification warnings
- ✅ City extraction from addresses
- ✅ Better logging

**Your action**:
- Always use correct spelling
- Add country context (e.g., "Dubai, UAE")
- Check console logs for warnings
