require('dotenv').config({ path: '.env' });
console.log('Token loaded:', !!process.env.GITHUB_TOKEN);
