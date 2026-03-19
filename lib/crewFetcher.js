const axios = require('axios');

const API_URL = 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';

/**
 * Fetch crew details from Corquaid API and filter for ISS members.
 * @returns {Promise<Array>} List of astronauts on the ISS.
 */
async function fetchCrew() {
  const response = await axios.get(API_URL, { timeout: 8000 });
  const data = response.data;

  return (data.people || [])
    .filter(person => person.iss === true)
    .map(person => ({
      name: person.name,
      agency: person.agency,
      position: person.position,
      country: person.country,
      url: person.url,
      image: person.image,
      iss: person.iss
    }));
}

module.exports = { fetchCrew };
