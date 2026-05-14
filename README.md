# Moca SDK

JavaScript library for integrating external applications with Moca Hub.

## Installation

### Option 1: Direct Include (Recommended)

Copy `moca-sdk.js` to your project and include it in your HTML:

```html
<script src="./moca-sdk.js"></script>
```

### Option 2: CDN (if hosted)

```html
<script src="https://moca-central-hub.netlify.app/moca-sdk.js"></script>
```

## Quick Start

```javascript
// 1. Initialize the SDK
const moca = new MocaSDK('https://moca-central-hub.netlify.app');

// 2. Authenticate on page load
await moca.init();

// 3. Check authentication
if (!moca.isAuthenticated()) {
  moca.showAccessDenied();
  return;
}

// 4. Access client info
const client = moca.getClient();
document.getElementById('client-logo').src = client.logo_url;
document.getElementById('client-name').textContent = client.name;

// 5. Use API keys
const openaiKey = moca.getConfig('OPENAI_API_KEY');
const apifyKey = moca.getConfig('APIFY_API_KEY');

// 6. Local Development (Optional)
// Enable mock mode to test without Moca Hub
if (window.location.hostname === 'localhost') {
  moca.enableMockMode({
    configurations: {
      OPENAI_API_KEY: 'sk-mock-key-for-testing',
      APIFY_API_KEY: 'mock-apify-key'
    }
  });
}
```

## Local Development (Mock Mode)

To test your app locally without needing a launch token from Moca Hub, use `enableMockMode()`.

```javascript
// Enable this ONLY in development
if (location.hostname === 'localhost') {
    moca.enableMockMode({
        client: { name: 'Local Client', logo_url: 'https://placehold.co/100' },
        user: { name: 'Local Dev', role: 'admin' },
        configurations: {
            OPENAI_API_KEY: 'your-test-key-here' 
        }
    });
}
// Calling init() will now succeed on localhost
await moca.init();


## API Reference

### Constructor

```javascript
const moca = new MocaSDK(hubUrl)
```

- `hubUrl` (string): The base URL of your Moca Hub instance

### Methods

#### `init()`

Initializes the SDK and validates the launch token. **Must be called before using any other methods.**

```javascript
const isAuthenticated = await moca.init();
```

Returns: `Promise<boolean>` - true if authenticated, false otherwise

#### `isAuthenticated()`

Checks if the user is authenticated.

```javascript
if (moca.isAuthenticated()) {
  // User is logged in
}
```

Returns: `boolean`

#### `getConfig(key)`

Gets a specific configuration value by key.

```javascript
const openaiKey = moca.getConfig('OPENAI_API_KEY');
```

Parameters:
- `key` (string): Configuration key name

Returns: `string | null`

#### `getAllConfigs()`

Gets all configuration values as an object.

```javascript
const configs = moca.getAllConfigs();
// { OPENAI_API_KEY: 'sk-...', APIFY_API_KEY: 'apify_...', ... }
```

Returns: `Object`

#### `getClient()`

Gets the current client information.

```javascript
const client = moca.getClient();
// { id: '...', name: 'Client Name', email: '...', logo_url: '...' }
```

Returns: `Object | null`

#### `getUser()`

Gets the current user information.

```javascript
const user = moca.getUser();
// { id: '...', name: 'User Name', email: '...', role: 'user', level: 2, job_title: 'SEO' }
```

Returns: `Object | null`

#### `getApplication()`

Gets the current application information.

```javascript
const app = moca.getApplication();
// { id: '...', name: 'App Name', description: '...' }
```

Returns: `Object | null`

#### `showAccessDenied()`

Displays an "Access Denied" screen and redirects to Moca Hub.

```javascript
if (!moca.isAuthenticated()) {
  moca.showAccessDenied();
}
```

#### `logout()`

Clears the current session.

```javascript
moca.logout();
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Moca App</title>
  <script src="./moca-sdk.js"></script>
</head>
<body>
  <div id="app" style="display:none;">
    <img id="logo" alt="Client Logo">
    <h1>Welcome <span id="username"></span></h1>
    <p>Client: <span id="clientname"></span></p>
  </div>

  <script>
    (async () => {
      const moca = new MocaSDK('https://moca-central-hub.netlify.app');
      
      if (!await moca.init()) {
        moca.showAccessDenied();
        return;
      }

      // Show the app
      document.getElementById('app').style.display = 'block';
      
      // Populate UI
      const client = moca.getClient();
      const user = moca.getUser();
      
      document.getElementById('logo').src = client.logo_url;
      document.getElementById('username').textContent = user.name;
      document.getElementById('clientname').textContent = client.name;
      
      // Use API keys
      const apiKey = moca.getConfig('OPENAI_API_KEY');
      console.log('OpenAI API Key available:', !!apiKey);
    })();
  </script>
</body>
</html>
```

## Session Storage

The SDK stores session data in `sessionStorage` with the key `moca_session`. Sessions expire after 8 hours of inactivity.

## Security Notes

- The launch token is single-use and expires after 5 minutes
- Session data is stored in `sessionStorage` (cleared when closing the tab)
- Never expose API keys in client-side code beyond what's necessary
- The SDK automatically cleans the token from the URL after validation
