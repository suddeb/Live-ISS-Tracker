const axios = require('axios');
const { fetchCrew } = require('../lib/crewFetcher');

jest.mock('axios');

const API_URL =
  'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json';

// ── Test fixture factory ──────────────────────────────────────────────────────

/**
 * Build a realistic person record. Any field can be overridden via `overrides`
 * so individual tests only specify what is relevant to them.
 */
const makePerson = (overrides = {}) => ({
  name:       'Jane Astronaut',
  agency:     'NASA',
  position:   'Flight Engineer',
  country:    'USA',
  flag_code:  'us',
  spacecraft: 'Crew Dragon',
  launched:   1712354400,
  url:        'https://example.com/bio',
  image:      'https://example.com/photo.jpg',
  iss:        true,
  ...overrides,
});

const makeResponse = (people) =>
  ({ data: { number: people.length, people } });

// ─────────────────────────────────────────────────────────────────────────────

describe('fetchCrew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns an array with one entry for a single-person response', async () => {
      axios.get.mockResolvedValue(makeResponse([makePerson()]));

      const crew = await fetchCrew();

      expect(Array.isArray(crew)).toBe(true);
      expect(crew).toHaveLength(1);
    });

    it('maps every person to the correct set of fields', async () => {
      const person = makePerson();
      axios.get.mockResolvedValue(makeResponse([person]));

      const [member] = await fetchCrew();

      expect(member).toEqual({
        name:       person.name,
        agency:     person.agency,
        position:   person.position,
        country:    person.country,
        flag_code:  person.flag_code,
        spacecraft: person.spacecraft,
        launched:   person.launched,
        url:        person.url,
        image:      person.image,
        iss:        person.iss,
      });
    });

    it('returns all people regardless of iss flag value', async () => {
      const issTrue  = makePerson({ name: 'ISS Crew',  iss: true  });
      const issFalse = makePerson({ name: 'CSS Crew',  iss: false });
      axios.get.mockResolvedValue(makeResponse([issTrue, issFalse]));

      const crew = await fetchCrew();

      expect(crew).toHaveLength(2);
      expect(crew.map(p => p.name)).toEqual(['ISS Crew', 'CSS Crew']);
    });

    it('preserves the original order from the API response', async () => {
      const people = ['Alice', 'Bob', 'Carol'].map(name => makePerson({ name }));
      axios.get.mockResolvedValue(makeResponse(people));

      const crew = await fetchCrew();

      expect(crew.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('correctly passes through boolean iss field for both true and false', async () => {
      axios.get.mockResolvedValue(makeResponse([
        makePerson({ name: 'On ISS',  iss: true  }),
        makePerson({ name: 'Off ISS', iss: false }),
      ]));

      const crew = await fetchCrew();

      expect(crew[0].iss).toBe(true);
      expect(crew[1].iss).toBe(false);
    });

    it('handles multi-agency crews', async () => {
      const agencies = ['NASA', 'ESA', 'Roscosmos', 'JAXA', 'CMSA'];
      const people   = agencies.map(agency => makePerson({ agency }));
      axios.get.mockResolvedValue(makeResponse(people));

      const crew = await fetchCrew();

      expect(crew.map(p => p.agency)).toEqual(agencies);
    });
  });

  // ── HTTP call verification ──────────────────────────────────────────────────

  describe('HTTP call', () => {
    it('calls axios.get exactly once per invocation', async () => {
      axios.get.mockResolvedValue(makeResponse([]));

      await fetchCrew();

      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('calls the Corquaid API URL', async () => {
      axios.get.mockResolvedValue(makeResponse([]));

      await fetchCrew();

      expect(axios.get).toHaveBeenCalledWith(API_URL, expect.any(Object));
    });

    it('passes an 8-second timeout', async () => {
      axios.get.mockResolvedValue(makeResponse([]));

      await fetchCrew();

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 8000 })
      );
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when people array is empty', async () => {
      axios.get.mockResolvedValue(makeResponse([]));

      const crew = await fetchCrew();

      expect(crew).toEqual([]);
    });

    it('returns an empty array when the people key is absent from the response', async () => {
      axios.get.mockResolvedValue({ data: { number: 0 } });

      const crew = await fetchCrew();

      expect(crew).toEqual([]);
    });

    it('returns an empty array when people is null', async () => {
      axios.get.mockResolvedValue({ data: { people: null } });

      const crew = await fetchCrew();

      expect(crew).toEqual([]);
    });

    it('returns an empty array when people is undefined', async () => {
      axios.get.mockResolvedValue({ data: { people: undefined } });

      const crew = await fetchCrew();

      expect(crew).toEqual([]);
    });

    it('maps a person with only a name — missing fields become undefined, no throw', async () => {
      axios.get.mockResolvedValue({ data: { people: [{ name: 'Minimal Person' }] } });

      const crew = await fetchCrew();

      expect(crew).toHaveLength(1);
      expect(crew[0].name).toBe('Minimal Person');
      expect(crew[0].agency).toBeUndefined();
      expect(crew[0].iss).toBeUndefined();
    });

    it('does not copy extra fields that are not in the whitelist', async () => {
      const personWithExtras = {
        ...makePerson(),
        secretToken:  'abc123',
        internalId:   42,
        rawApiField:  'should be dropped',
      };
      axios.get.mockResolvedValue({ data: { people: [personWithExtras] } });

      const [member] = await fetchCrew();

      expect(member).not.toHaveProperty('secretToken');
      expect(member).not.toHaveProperty('internalId');
      expect(member).not.toHaveProperty('rawApiField');
    });

    it('returns new objects — mutating the result does not affect subsequent calls', async () => {
      const original = makePerson({ name: 'Immutable' });
      axios.get.mockResolvedValue(makeResponse([original]));

      const [first] = await fetchCrew();
      first.name = 'Mutated';

      // Subsequent call should still get the original API response
      const [second] = await fetchCrew();
      expect(second.name).toBe('Immutable');
    });

    it('handles a large crew list (50 members) without error', async () => {
      const people = Array.from({ length: 50 }, (_, i) =>
        makePerson({ name: `Person ${i}` })
      );
      axios.get.mockResolvedValue(makeResponse(people));

      const crew = await fetchCrew();

      expect(crew).toHaveLength(50);
    });
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('rejects with the original network error', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      await expect(fetchCrew()).rejects.toThrow('Network Error');
    });

    it('rejects on a timeout', async () => {
      const timeoutErr    = new Error('timeout of 8000ms exceeded');
      timeoutErr.code     = 'ECONNABORTED';
      axios.get.mockRejectedValue(timeoutErr);

      await expect(fetchCrew()).rejects.toThrow('timeout of 8000ms exceeded');
    });

    it('rejects on a 404 HTTP error', async () => {
      const notFoundErr          = new Error('Request failed with status code 404');
      notFoundErr.response       = { status: 404, data: 'Not Found' };
      axios.get.mockRejectedValue(notFoundErr);

      await expect(fetchCrew()).rejects.toThrow('404');
    });

    it('rejects on a 500 HTTP error', async () => {
      const serverErr        = new Error('Request failed with status code 500');
      serverErr.response     = { status: 500, data: 'Internal Server Error' };
      axios.get.mockRejectedValue(serverErr);

      await expect(fetchCrew()).rejects.toThrow('500');
    });

    it('does not silently swallow errors — the returned promise must reject', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));

      await expect(fetchCrew()).rejects.toThrow();
    });

    it('does not cache a prior success after a subsequent failure', async () => {
      axios.get
        .mockResolvedValueOnce(makeResponse([makePerson({ name: 'First' })]))
        .mockRejectedValueOnce(new Error('Transient failure'));

      const firstResult = await fetchCrew();
      expect(firstResult[0].name).toBe('First');

      await expect(fetchCrew()).rejects.toThrow('Transient failure');
    });
  });

  // ── Side effects ─────────────────────────────────────────────────────────────

  describe('side effects', () => {
    it('makes a fresh HTTP request on every call (no caching)', async () => {
      axios.get.mockResolvedValue(makeResponse([makePerson()]));

      await fetchCrew();
      await fetchCrew();
      await fetchCrew();

      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    it('returns different data on each call when the API response changes', async () => {
      axios.get
        .mockResolvedValueOnce(makeResponse([makePerson({ name: 'Crew A' })]))
        .mockResolvedValueOnce(makeResponse([makePerson({ name: 'Crew B' })]));

      const firstBatch  = await fetchCrew();
      const secondBatch = await fetchCrew();

      expect(firstBatch[0].name).toBe('Crew A');
      expect(secondBatch[0].name).toBe('Crew B');
    });

    it('resolves concurrent calls independently', async () => {
      axios.get.mockResolvedValue(makeResponse([makePerson()]));

      const [a, b] = await Promise.all([fetchCrew(), fetchCrew()]);

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('one failing concurrent call does not affect a succeeding one', async () => {
      axios.get
        .mockResolvedValueOnce(makeResponse([makePerson({ name: 'Success' })]))
        .mockRejectedValueOnce(new Error('Parallel failure'));

      const [fulfilled, rejected] = await Promise.allSettled([
        fetchCrew(),
        fetchCrew(),
      ]);

      expect(fulfilled.status).toBe('fulfilled');
      expect(fulfilled.value[0].name).toBe('Success');
      expect(rejected.status).toBe('rejected');
      expect(rejected.reason.message).toBe('Parallel failure');
    });
  });
});
