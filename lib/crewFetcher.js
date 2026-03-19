const axios = require('axios');

const API_URL = 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';

/**
 * Fetch crew details from Corquaid API from all space stations.
 * @returns {Promise<Array>} List of astronauts in space.
 */
async function fetchCrew() {
  const response = await axios.get(API_URL, { timeout: 8000 });
  const data = response.data;

  return (data.people || [])
    .map(person => ({
      name: person.name,
      agency: person.agency,
      position: person.position,
      country: person.country,
      flag_code: person.flag_code,
      spacecraft: person.spacecraft,
      launched: person.launched,
      url: person.url,
      image: person.image,
      iss: person.iss
    }));
}

module.exports = { fetchCrew };
