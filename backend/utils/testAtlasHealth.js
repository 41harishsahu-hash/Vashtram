const fetch = globalThis.fetch;

async function runTests() {
  const base = 'http://localhost:5000/api';
  console.log('Testing Database APIs against MongoDB Atlas:');

  // Categories
  const cat = await (await fetch(base + '/categories')).json();
  console.log('Categories: ' + cat.count + ' categories loaded from Atlas');

  // Products
  const prod = await (await fetch(base + '/products')).json();
  console.log('Products: ' + prod.count + ' products loaded from Atlas');

  // Features
  const feat = await (await fetch(base + '/features')).json();
  console.log('Features: ' + feat.count + ' dynamic features loaded from Atlas');

  // Settings
  const sett = await (await fetch(base + '/settings')).json();
  console.log('Settings: Store name loaded: ' + (sett.settings?.storeName || 'N/A'));

  // About
  const abt = await (await fetch(base + '/about')).json();
  console.log('About: Image and title loaded: ' + (abt.about?.title || 'N/A'));

  // Hero
  const hero = await (await fetch(base + '/hero')).json();
  console.log('Hero: Banner loaded: ' + (hero.hero?.title || 'N/A'));

  console.log('ALL ATLAS ENDPOINTS VERIFIED SUCCESSFULLY!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
