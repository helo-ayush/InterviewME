import { useAuth } from '@clerk/clerk-react';

// We write this function ONCE in a file named api.js
export const useApi = () => {
  const { getToken } = useAuth(); // 1. Access the token getter
  // 2. We return a custom function that acts like normal fetch
  const authenticatedFetch = async (url, options = {}) => {
    //options = {} — optional config object (method, body, headers, etc.) — defaults to empty object if not provided
    const token = await getToken(); // 3. Get the token automatically
    // 4. Attach the token to whatever headers are passed
    const headers = {
      ...options.headers,//...options.headers — spreads any existing headers (e.g., Content-Type, custom headers)
      'Authorization': `Bearer ${token}`,
    };
    // 5. Run the actual browser fetch with the token attached
    return fetch(url, { ...options, headers });
  };
  return authenticatedFetch;
};

// CODE EXAMPLE OF HOW TO FETCH USING THiS NEW FETCH METHOD

// import { useApi } from './api';

// // Inside RepoList.jsx
// const apiFetch = useApi();
// const response = await apiFetch('/api/github/repos'); // Helper did the token for you!
