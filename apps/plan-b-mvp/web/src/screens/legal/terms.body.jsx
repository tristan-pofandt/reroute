const PUSH_BIKE_MAX_KM = 5; // keep in step with PUSH_BIKE_MAX_KM in app.js and live_routes.py

export default function TermsBody() {
  return (<>
    <p className="eyebrow">Reroute</p><h1 className="large-title">Terms of Use</h1>
    <p className="subtitle">A student prototype for exploring journey options. It is not an official transport service or a substitute for your own judgement.</p>
    <h2>Estimates, not guarantees</h2>
    <p>Route times, fares, parking availability, fuel costs, weather, live vehicle positions and disruption information can be incomplete, delayed or wrong. E-scooter and e-bike times use a Google Maps cycling route with an assumed average speed (15 and 20 km/h), not a measured one, and their hire cost is an estimate from assumed prices (an unlock fee plus a price per minute, editable in Settings), not a quote from Lime or Neuron. Push-bike times use Google's own cycling estimate, and the push bike is only offered for trips up to {PUSH_BIKE_MAX_KM} km. The app does not check hire availability, real hire prices, local access rules or safe paths for any of them. The rain radar shows the last two hours of radar and is not a forecast. The CO₂ shown for them counts tailpipe emissions only, so charging and manufacturing are not counted. Check current signs, services, fares, prices and conditions before leaving.</p>
    <p>Offline maps use an area you downloaded earlier. Offline routes and times are estimates from that saved OpenStreetMap map and Translink's published timetables: they do not include live delays, cancellations, disruptions, road closures or traffic, and the timetables only cover the days you downloaded. Check signs, services and conditions when you can.</p>
    <p>Do not use the app while driving, riding or crossing a road. In-app directions and location readings may be inaccurate. Follow road rules and use your own judgement.</p>
    <h2>Third-party services</h2>
    <p>Route search and maps use Google Maps Platform, and route results are shown on a Google map. Use is also subject to the <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google Terms of Service</a>, the <a href="https://www.google.com/intl/en-US_US/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps Additional Terms</a> and Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. Public-transport alerts and schedules come from Translink; traffic events come from QLDTraffic; weather and fallback elevation come from Open-Meteo; the rain radar comes from RainViewer. The Lime and Neuron buttons open those companies' app store listings or websites, which have their own terms. Their services may change or be unavailable.</p>
    <h2>Shared rides and notifications</h2>
    <p>Ride-board posts are visible to people using the same Reroute server. Use a nickname and broad areas, not contact details or sensitive information. Posts expire automatically. Background alerts require a browser push subscription and may be delivered by your browser's push provider.</p>
    <h2>Prototype availability</h2>
    <p>This prototype is provided as-is for evaluation. No account, transport booking, payment, scooter hire or emergency response is provided. The profile button is a placeholder: it has no account behind it. The team may change or stop the prototype at any time.</p>
    <p className="fine">Review before public release: confirm the team's hosting terms, support contact and legal requirements. This page is plain-language product information, not legal advice.</p>
    <button className="btn btn-secondary" data-action="go" data-screen="privacy">Read the Privacy Policy</button>
  </>);
}
