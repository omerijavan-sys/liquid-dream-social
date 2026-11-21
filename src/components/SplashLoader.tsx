/** Full-screen loading screen: the Primegram icon, wordmark and an animated loading line (styles live in index.html). */
const SplashLoader = () => (
  <div className="pg-splash">
    <img src="/icons/p-default.png" alt="" width={132} height={132} />
    <h1>Primegram</h1>
    <div className="pg-line"><i /></div>
  </div>
);
export default SplashLoader;
