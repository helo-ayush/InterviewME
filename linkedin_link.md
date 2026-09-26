# Guide: Integrating LinkedIn OAuth & Account Connections with Clerk

This guide explains how to connect LinkedIn to your application in the future to authenticate users, link their accounts, and securely fetch their professional data.

---

## Part 1: Setting Up the LinkedIn Developer Portal (Prerequisites)

Because LinkedIn has strict security policies, you **must** link your developer app to a verified LinkedIn Company Page. Without this, LinkedIn will block all authentication endpoints.

### Step 1: Create a LinkedIn Company Page (if you don't have one)
1. Go to your personal LinkedIn account.
2. Click the **Work** icon in the top right corner of your LinkedIn homepage.
3. Click **Create a Company Page** at the bottom of the menu.
4. Fill in the details (e.g. name, website, industry) and click **Create page**.

### Step 2: Create your Developer Application
1. Go to the [LinkedIn Developer Portal](https://developer.linkedin.com/).
2. Click **Create App**.
3. Name your app (e.g., `AiInterview`) and enter your privacy policy URL.
4. **Associate the App with your Company Page**:
   * Search for your new Company Page in the search bar and select it.
5. Upload a logo and click **Create app**.

### Step 3: Verify your Application Connection
1. Once created, go to the **Settings** tab of your app.
2. Click **Verify Company**.
3. Click **Copy URL** to copy the verification link.
4. Open a new browser tab, paste that URL, and hit Enter.
5. Click **Approve / Verify** to authorize the developer app on behalf of your company page.
6. Go back to your developer portal page, and click **I'm done**.

### Step 4: Add the "Sign In" Product (Crucial)
1. Go to the **Products** tab of your developer app.
2. Scroll to **Available Products** and locate **Sign In with LinkedIn using OpenID Connect**.
3. Click **Request Access** (this is approved instantly). 
   * *Note: If you do not see this product, verify that Step 3 (Company verification) was completed correctly.*

### Step 5: Add Redirect URLs
1. Go to the **Auth** tab of your app.
2. Under **OAuth 2.0 settings**, click **Add redirect URL**.
3. Paste your Clerk Callback URL (e.g. `https://your-instance.clerk.accounts.dev/v1/oauth_callback`).
4. Click **Update** / **Save**.
5. Copy your **Client ID** and **Primary Client Secret** from the top of this tab.

---

## Part 2: Configuring the Clerk Dashboard

1. Log in to the [Clerk Dashboard](https://dashboard.clerk.com/).
2. Go to **User & Authentication** -> **SSO connections** in the left menu.
3. Select **Add connection** -> choose **LinkedIn**.
4. Turn on the **"Use custom credentials"** toggle.
5. Paste the **Client ID** and **Client Secret** you copied from LinkedIn.
6. Toggle **Enable for sign-up and sign-in** to **ON** (purple).
7. Go back to the main list of SSO Connections and set LinkedIn to **"Account Linking Only"**.

---

## Part 3: Frontend Implementation (React)

When using custom components, Clerk does not automatically redirect the browser when you trigger `createExternalAccount`. You must catch the returned promise and redirect the browser manually.

### React Code Example:
```jsx
import React from 'react';
import { useUser, useReverification } from '@clerk/clerk-react';

export default function ConnectLinkedIn() {
  const { user, isLoaded } = useUser();

  // 1. Wrap the sensitive action in Clerk's useReverification hook
  // Note the strategy name: 'oauth_linkedin_oidc'
  const connectLinkedInWithReverification = useReverification(() =>
    user?.createExternalAccount({
      strategy: 'oauth_linkedin_oidc',
      redirectUrl: window.location.href // Redirect back to this page after connecting
    })
  );

  const handleConnect = async () => {
    try {
      // 2. Execute the wrapped function
      const externalAccount = await connectLinkedInWithReverification();
      
      // 3. Extract the redirect URL returned by Clerk
      const redirectUrl = externalAccount.verification?.externalVerificationRedirectURL;
      
      if (redirectUrl) {
        // 4. Manually redirect the browser window to LinkedIn's consent page
        window.location.href = typeof redirectUrl === 'object' ? redirectUrl.href : String(redirectUrl);
      }
    } catch (err) {
      console.error("Error connecting LinkedIn:", err);
    }
  };

  // 5. Check if LinkedIn is connected
  const isLinkedInConnected = user?.externalAccounts.some(acc => acc.provider === 'linkedin');

  if (!isLoaded) return <p>Loading...</p>;

  return (
    <div>
      {isLinkedInConnected ? (
        <p>LinkedIn is Connected! ✓</p>
      ) : (
        <button onClick={handleConnect}>Connect LinkedIn</button>
      )}
    </div>
  );
}
```

---

## Part 4: Backend Integration & Querying LinkedIn (Express)

Once the user successfully connects LinkedIn, Clerk stores their LinkedIn Access Token securely. You can retrieve this token on your Express backend using Clerk's Node.js SDK to fetch their profile or past work.

### Express Code Example:
```javascript
const express = require('express');
const { requireAuth, clerkClient } = require('@clerk/clerk-sdk-node');
const app = express();

// Protect this route with Clerk's middleware
app.get('/api/linkedin/profile', requireAuth(), async (req, res) => {
  const userId = req.auth.userId; // Securely get the user ID from the JWT token

  try {
    // 1. Ask Clerk for the user's LinkedIn access token
    const providerTokens = await clerkClient.users.getUserOauthAccessToken(
      userId, 
      'oauth_linkedin_oidc'
    );

    if (!providerTokens || providerTokens.length === 0) {
      return res.status(400).json({ error: 'LinkedIn account is not connected.' });
    }

    const linkedinAccessToken = providerTokens[0].token;

    // 2. Fetch the user's profile from LinkedIn's OpenID Connect UserInfo endpoint
    const linkedinResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${linkedinAccessToken}`,
        'Accept': 'application/json'
      }
    });

    const profileData = await linkedinResponse.json();

    // 3. Return the data to the client
    res.json({ profile: profileData });

  } catch (error) {
    console.error('Error fetching LinkedIn token or profile:', error);
    res.status(500).json({ error: 'Failed to retrieve LinkedIn data.' });
  }
});
```

---

## Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Bummer, something went wrong"** | Mismatched Redirect URI or missing Product | Double-check that your redirect URI in the LinkedIn Auth tab is exactly matched, and verify that the "Sign In with LinkedIn using OpenID Connect" product is active in the Products tab. |
| **403: "Reverification required"** | Security Session protection | Call the function using `useReverification` as shown in Part 3. Alternatively, disable Reverification in Clerk Dashboard under **Configure -> Sessions**. |
| **"oauth_linkedin is not enabled"** | Invalid Strategy Name | Ensure you are calling `oauth_linkedin_oidc` on the frontend, because the legacy `oauth_linkedin` is deprecated and disabled in modern Clerk setups. |
