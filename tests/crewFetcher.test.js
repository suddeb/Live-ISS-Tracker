const axios = require('axios');
const { fetchCrew } = require('../lib/crewFetcher');

jest.mock('axios');

describe('Crew Fetcher', () => {
  const mockCrewData = {
    number: 5,
    people: [
      {
        name: 'Astronaut 1',
        agency: 'NASA',
        position: 'Commander',
        country: 'USA',
        flag_code: 'us',
        spacecraft: 'Crew Dragon',
        launched: 1712354400,
        url: 'https://bio1.com',
        image: 'https://img1.com',
        iss: true
      },
      {
        name: 'Astronaut 2',
        agency: 'Roscosmos',
        position: 'Flight Engineer',
        country: 'Russia',
        flag_code: 'ru',
        spacecraft: 'Soyuz MS-25',
        launched: 1711193461,
        url: 'https://bio2.com',
        image: 'https://img2.com',
        iss: true
      },
      {
        name: 'Taikonaut 1',
        agency: 'CMSA',
        position: 'Commander',
        country: 'China',
        flag_code: 'cn',
        spacecraft: 'Shenzhou 18',
        launched: 1714041600,
        url: 'https://bio3.com',
        image: 'https://img3.com',
        iss: false
      },
      {
        name: 'Astronaut 3',
        agency: 'ESA',
        position: 'Flight Engineer',
        country: 'Denmark',
        flag_code: 'dk',
        spacecraft: 'Crew Dragon',
        launched: 1712354400,
        url: 'https://bio4.com',
        image: 'https://img4.com',
        iss: true
      },
      {
        name: 'Astronaut 4',
        agency: 'JAXA',
        position: 'Mission Specialist',
        country: 'Japan',
        flag_code: 'jp',
        spacecraft: 'Crew Dragon',
        launched: 1712354400,
        url: 'https://bio5.com',
        image: 'https://img5.com',
        iss: true
      }
    ]
  };

  test('should fetch all crew members from all space stations and all agencies', async () => {
    axios.get.mockResolvedValue({ data: mockCrewData });

    const crew = await fetchCrew();

    expect(crew).toHaveLength(5);
    expect(crew.map(p => p.agency)).toContain('NASA');
    expect(crew.map(p => p.agency)).toContain('Roscosmos');
    expect(crew.map(p => p.agency)).toContain('CMSA');
    expect(crew.map(p => p.agency)).toContain('ESA');
    expect(crew.map(p => p.agency)).toContain('JAXA');
  });

  test('should extract all required fields including agency', async () => {
    axios.get.mockResolvedValue({ data: mockCrewData });

    const crew = await fetchCrew();

    expect(crew[0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      agency: expect.any(String),
      position: expect.any(String),
      country: expect.any(String),
      flag_code: expect.any(String),
      spacecraft: expect.any(String),
      launched: expect.any(Number),
      url: expect.any(String),
      image: expect.any(String),
      iss: expect.any(Boolean)
    }));
  });

  test('should handle API errors gracefully', async () => {
    axios.get.mockRejectedValue(new Error('API Error'));

    await expect(fetchCrew()).rejects.toThrow('API Error');
  });
});
