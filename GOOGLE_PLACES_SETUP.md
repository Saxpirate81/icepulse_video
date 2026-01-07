# Google Places API Setup (Optional)

The LocationSearch component can use Google Places API for automatic rink/location suggestions. This is **optional** - the component will work without it, but users will need to manually type location names.

## Setup Instructions

### Step 1: Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Places API"
   - Click **Enable**
4. Create an API key:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copy the API key
5. (Recommended) Restrict the API key:
   - Click on the API key to edit it
   - Under **API restrictions**, select **Restrict key**
   - Choose **Places API** only
   - Under **Application restrictions**, you can restrict by HTTP referrer for web apps

### Step 2: Add to Environment Variables

Add the API key to your `.env` file:

```env
VITE_GOOGLE_PLACES_API_KEY=your_api_key_here
```

### Step 3: Restart Dev Server

Restart your development server to pick up the new environment variable:

```bash
npm run dev
```

## How It Works

- **With API Key**: As users type, the component searches Google Places for rinks and venues, showing suggestions in a dropdown
- **Without API Key**: Users can still type location names manually. The "Don't see the rink? Add the name here..." option is always available

## Features

- ✅ Real-time search as you type (with API key)
- ✅ Shows rink name and location (city/state)
- ✅ Manual entry option always available
- ✅ Works without API key (manual entry only)
- ✅ Debounced search (waits 300ms after typing stops)

## Cost

Google Places API has a free tier:
- **$200 free credit per month** (covers ~40,000 autocomplete requests)
- After that: $2.83 per 1,000 requests

For most organizations, the free tier should be sufficient.

## Alternative Options

If you don't want to use Google Places API, the component will:
- Still allow manual entry of location names
- Show the "Don't see the rink? Add the name here..." option
- Work perfectly fine for manual data entry

## Troubleshooting

### No suggestions appearing?

1. Check that `VITE_GOOGLE_PLACES_API_KEY` is set in `.env`
2. Restart your dev server
3. Check browser console for API errors
4. Verify the API key is enabled for Places API in Google Cloud Console

### API key errors?

- Make sure Places API is enabled in Google Cloud Console
- Check that the API key isn't restricted too heavily
- Verify billing is enabled (required even for free tier)
