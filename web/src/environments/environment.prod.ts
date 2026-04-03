export const environment = {
  production: true,
  // Uses the API on port 3000 of the same host. Override if API is on a different domain.
  apiUrl: (typeof window !== 'undefined' ? window.location.protocol + '//' + window.location.hostname : 'http://localhost') + ':3000'
};
