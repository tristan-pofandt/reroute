import data from "./licences.data.json";

const a = (href, text) => <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>;
const row = (p) => (
  <div className="row" key={p.name}><span className="row-label"><b>{p.name}{p.version ? ` ${p.version}` : ""}</b><small>{p.license}{p.copyright ? `. ${p.copyright}` : ""}</small>{a(p.url, "Source and licence text")}</span></div>
);

export default function LicencesBody() {
  return (<>
    <p className="eyebrow">About this prototype</p><h1 className="large-title">Licences</h1>
    <p className="subtitle">Reroute is built on open data and open-source software. This page gives the credit and licence notices they ask for.</p>
    <h2>Data and services</h2>
    <div className="group"><div className="group-card">
      <div className="row"><span className="row-label"><b>Translink (GTFS and GTFS-Realtime)</b><small>Contains public transport data from Translink, Queensland Government, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). Data is provided as is; changes were made to show it in this app. Not an official Translink service.</small>{a("https://translink.com.au/about-translink/open-data", "Translink open data")} · {a("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0")}</span></div>
      <div className="row"><span className="row-label"><b>QLDTraffic (Transport and Main Roads)</b><small>Contains information from the QLDTraffic GeoJSON API dataset, Transport and Main Roads, Queensland Government, licensed under CC BY 4.0. Supplied as is.</small>{a("https://www.data.qld.gov.au/dataset/131940-traffic-and-travel-information-geojson-api", "Dataset")} · {a("https://qldtraffic.qld.gov.au/more/Disclaimer/index.html", "Disclaimer")}</span></div>
      <div className="row"><span className="row-label"><b>Google Maps Platform</b><small>Maps, routes, places and elevation are provided by Google and used under the Google Maps Platform Terms of Service. Map data © Google. The Google logo and attribution on every map must not be removed. Google content is not stored offline by Reroute.</small>{a("https://cloud.google.com/maps-platform/terms", "Platform terms")} · {a("https://www.google.com/intl/en-US_US/help/terms_maps/", "Maps additional terms")}</span></div>
      <div className="row"><span className="row-label"><b>OpenStreetMap</b><small>Offline maps and routing use © OpenStreetMap contributors, available under the Open Database Licence (ODbL). Offline map extracts made from it are a derived database and are shared under the same licence.</small>{a("https://www.openstreetmap.org/copyright", "© OpenStreetMap contributors")} · {a("https://opendatacommons.org/licenses/odbl/", "ODbL")}</span></div>
      <div className="row"><span className="row-label"><b>Open-Meteo</b><small>Weather data by Open-Meteo.com, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). The free service is for non-commercial use.</small>{a("https://open-meteo.com/", "Open-Meteo")} · {a("https://open-meteo.com/en/licence", "Licence")} · {a("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0")}</span></div>
      <div className="row"><span className="row-label"><b>RainViewer</b><small>Rain radar images by RainViewer. The free API is for personal and educational use and is limited to map zoom level 7.</small>{a("https://www.rainviewer.com/", "RainViewer")} · {a("https://www.rainviewer.com/api.html", "API terms")}</span></div>
      <div className="row"><span className="row-label"><b>Google Fonts</b><small>The Inter typeface is licensed under the SIL Open Font Licence 1.1.</small>{a("https://github.com/rsms/inter/blob/master/LICENSE.txt", "Licence")}</span></div>
    </div></div>
    <h2>Software shipped in the app (JavaScript)</h2>
    <div className="group"><div className="group-card">{data.npm.map(row)}</div></div>
    <h2>Software on the server (Python)</h2>
    <div className="group"><div className="group-card">{data.python.map(row)}</div></div>
    <h2>Bundled libraries and fonts</h2>
    <div className="group"><div className="group-card">{data.vendored.map(row)}</div></div>
    <p className="fine">Generated from the package lists on {data.generated} by web/scripts/gen-licences.mjs. The licence named is the one each package declares; the link leads to its full text, which also applies. Human review required: this list is not a legal clearance.</p>
    <button className="btn btn-secondary" data-action="go" data-screen="sources">About and data sources</button>
  </>);
}
