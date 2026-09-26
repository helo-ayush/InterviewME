import React from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignOutButton,
  useUser,
  useReverification
} from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const App = () => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  // 1. Wrap the sensitive createExternalAccount action inside useReverification.
  //    If Clerk detects that the user needs to re-verify their session (e.g. email OTP),
  //    it will automatically show the verification screen and resume this function once verified.
  const connectAccountWithReverification = useReverification((provider) =>
    user?.createExternalAccount({
      strategy: provider,
      redirectUrl: window.location.href // Redirect back to our page after successful OAuth linking
    })
  );

  // 2. Click handler to start the OAuth account connection flow
  const handleConnectAccount = async (provider) => {
    try {
      // Execute the reverified function, which returns the external account object
      const externalAccount = await connectAccountWithReverification(provider);

      const verification = externalAccount.verification;

      // Clerk returns a redirect URL that we must send the browser to (e.g. GitHub authorization page)
      let redirectUrl = null;
      if (verification) {
        redirectUrl = verification.externalVerificationRedirectURL;

        // If Clerk returns the URL as an object, extract its string representation
        if (redirectUrl && typeof redirectUrl === 'object' && redirectUrl.href) {
          redirectUrl = redirectUrl.href;
        }
      }

      // If a valid redirect URL exists, send the browser to that URL to complete authorization
      if (redirectUrl) {
        window.location.href = String(redirectUrl);
      }
    } catch (err) {
      // Catch and log any errors (such as user cancelling the verification modal)
      console.error(`Error during account connection for ${provider}:`, err);
    }
  };

  // 3. Wrap the sensitive account.destroy action inside useReverification.
  const disconnectAccountWithReverification = useReverification((account) =>
    account.destroy()
  );

  // 4. Click handler to unlink/disconnect an OAuth account
  const handleDisconnectAccount = async (provider) => {
    try {
      // Find the specific connected account object in Clerk's list
      const accountToDisconnect = user?.externalAccounts.find(acc => acc.provider === provider);

      if (accountToDisconnect) {
        // Call the reverified destroy function
        await disconnectAccountWithReverification(accountToDisconnect);
      }
    } catch (err) {
      console.error(`Error disconnecting ${provider}:`, err);
    }
  };

  // Check if GitHub is currently connected AND verified
  const isGitHubConnected = user?.externalAccounts.some(
    acc => acc.provider === 'github' && acc.verification?.status === 'verified'
  );

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex justify-center items-center">
        <p className="text-xl">Loading authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl text-center border border-slate-700">

        {/* --- SIGNED OUT VIEW --- */}
        <SignedOut>
          <h2 className="text-2xl font-bold mb-4">AiInterview</h2>
          <p className="text-slate-400 text-sm mb-6">Login with Google to start your workspace</p>

          <SignInButton mode="modal">
            <button className="bg-white text-slate-950 hover:bg-slate-200 px-6 py-3 rounded-lg font-bold w-full cursor-pointer">
              Login with Google
            </button>
          </SignInButton>
        </SignedOut>

        {/* --- SIGNED IN VIEW --- */}
        <SignedIn>
          {user && (
            <div>
              {/* User Profile */}
              <img
                src={user.imageUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-500"
              />
              <h2 className="text-2xl font-bold">Hello, {user.fullName || user.username}!</h2>
              <p className="text-indigo-400 text-sm mb-6">{user.primaryEmailAddress?.emailAddress}</p>

              {/* Connections Section */}
              <div className="bg-slate-900/50 p-4 rounded-lg text-left text-sm space-y-4 mb-6 border border-slate-700/50">
                <p className="font-semibold text-slate-300">🔗 Personalize Workspace:</p>

                {/* GitHub Connection */}
                <div className="flex justify-between items-center">
                  <span>GitHub</span>
                  {isGitHubConnected ? (
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 font-semibold">Connected ✓</span>
                      <button
                        onClick={() => handleDisconnectAccount('github')}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer font-medium"
                      >
                        Unlink
                      </button>
                      <button
                        onClick={() => { navigate("/dashboard/interview") }}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline cursor-pointer font-medium"
                      >
                        Take Interview
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnectAccount('oauth_github')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-xs px-3 py-1.5 rounded font-semibold cursor-pointer"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <SignOutButton>
                <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm w-full font-semibold cursor-pointer border border-red-500/10">
                  Log Out
                </button>
              </SignOutButton>
            </div>
          )}
        </SignedIn>

      </div>
    </div>
  );
};

export default App;
