import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Auth0Provider } from '@auth0/auth0-react'


createRoot(document.getElementById('root')).render(
  <Auth0Provider
      domain="dev-hb5tnbkuyk217lt2.us.auth0.com"
      clientId="FrmpugfW5ooQObVrRx0P7A5e1nVkY6Dr"
      authorizationParams={{
        audience: "https://dev-hb5tnbkuyk217lt2.us.auth0.com/api/v2/",
        redirect_uri: window.location.origin
      }}
    >
    <App />
  </Auth0Provider>,
)