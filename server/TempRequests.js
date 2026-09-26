// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node'); // Import Clerk middleware

// const app = express();
// const PORT = process.env.PORT || 3000;

// app.use(cors());
// app.use(express.json());

// // Public Route
// app.get('/api/health', (req, res) => {
//   res.status(200).json({ message: 'ok' });
// });

// // Protected Route (Uses Clerk middleware)
// // If the token is missing or invalid, ClerkExpressRequireAuth automatically returns 401 Unauthorized
// app.get('/api/protected-data', ClerkExpressRequireAuth(), (req, res) => {
//   // Clerk automatically populates req.auth with the verified user's details
//   const userId = req.auth.userId;

//   console.log(`Request made by authenticated user: ${userId}`);

//   res.status(200).json({
//     message: "This is secure data!",
//     userId: userId
//   });
// });

// // Error handler for unauthorized requests (Clerk throws an error if unauthenticated)
// app.use((err, req, res, next) => {
//   if (err.message === 'Unauthenticated') {
//     return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
//   }
//   next(err);
// });

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });










require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ClerkExpressRequireAuth, clerkClient } = require('@clerk/clerk-sdk-node');

const app = express();
app.use(cors());
app.use(express.json());

// Protected endpoint to fetch user's GitHub repositories
app.get('/api/github/repos', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    // 1. Get the verified userId from the middleware
    const userId = req.auth.userId;

    // 2. Query Clerk's API to fetch the user's GitHub OAuth token
    // Note: Clerk uses your CLERK_SECRET_KEY in the background to authenticate this request.
    const oauthTokens = await clerkClient.users.getUserOauthAccessToken(
      userId, 
      'oauth_github' // the provider slug
    );

    // 3. Extract the actual token string
    if (!oauthTokens || oauthTokens.length === 0) {
      return res.status(400).json({ error: 'No GitHub account connected or token found.' });
    }
    
    const githubToken = oauthTokens[0].token;

    // 4. Use the GitHub token to fetch the user's repositories from GitHub's API
    const githubResponse = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'InterviewME-Backend' // GitHub API requires a User-Agent header
      }
    });

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json();
      return res.status(githubResponse.status).json({ error: 'GitHub API error', details: errorData });
    }

    const repos = await githubResponse.json();

    // 5. Send the repos back to your frontend
    res.status(200).json({ repos });

  } catch (error) {
    console.error('Error fetching GitHub token/repos:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
