const { clerkClient } = require('@clerk/clerk-sdk-node');

async function getrepos(userId){
    const oauthTokens = await clerkClient.users.getUserOauthAccessToken(
      userId, 
      'oauth_github' // the provider slug
    );

    // We will just return the function and there we will check for error
    if(!oauthTokens || oauthTokens.length == 0){
        return { error: 'No GitHub account connected or token found.' };
    }
    const githubToken = oauthTokens[0].token;
    
    
    // Using Github access token to send the request to github server
    const githubResponse = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'InterviewME-Backend' // GitHub API requires a User-Agent header
      }
    });

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json();
      return { error: 'GitHub API error', details: errorData };
    }

    const repos = await githubResponse.json();
    
    return repos;
}

module.exports = { getrepos };