const axios = require('axios');
const { fetchCrew } = require('../lib/crewFetcher');

jest.mock('axios');

describe('Crew Fetcher', () => {
  const mockCrewData = {
    number: 3,
    people: [
      {
        name: 'Astronaut 1',
        agency: 'NASA',
        position: 'Commander',
        country: 'USA',
        url: 'https://bio1.com',
        image: 'https://img1.com',
        iss: true
      },
      {
        name: 'Astronaut 2',
        agency: 'Roscosmos',
        position: 'Flight Engineer',
        country: 'Russia',
        url: 'https://bio2.com',
        image: 'https://img2.com',
        iss: true
      },
      {
        name: 'Taikonaut 1',
        agency: 'CMSA',
        position: 'Commander',
        country: 'China',
        url: 'https://bio3.com',
        image: 'https://img3.com',
        iss: false
      }
    ]
  };

  test('should fetch and filter crew members on the ISS', async () => {
    axios.get.mockResolvedValue({ data: mockCrewData });

    const crew = await fetchCrew();

    expect(crew).toHaveLength(2);
    expect(crew[0].name).toBe('Astronaut 1');
    expect(crew[1].name).toBe('Astronaut 2');
    expect(crew.every(p => p.iss === true)).toBe(true);
  });

  test('should extract all required fields', async () => {
    axios.get.mockResolvedValue({ data: mockCrewData });

    const crew = await fetchCrew();

    expect(crew[0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      agency: expect.any(String),
      position: expect.any(String),
      country: expect.any(String),
      url: expect.any(String),
      image: expect.any(String)
    }));
  });

  test('should handle API errors gracefully', async () => {
    axios.get.mockRejectedValue(new Error('API Error'));

    await expect(fetchCrew()).rejects.toThrow('API Error');
  });
});
