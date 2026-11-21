import AsyncStorage from '@react-native-async-storage/async-storage';
import { keyValueStore, safeStorage } from '@/state/storage';

const refused = () => Promise.reject(new Error('Access is denied for this document.'));

describe('storage that can be refused', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads back what it stored when the device accepts it', async () => {
    await safeStorage.setItem('scarlets:test-a', 'one');
    expect(await safeStorage.getItem('scarlets:test-a')).toBe('one');
    expect(await AsyncStorage.getItem('scarlets:test-a')).toBe('one');
  });

  it('keeps values for the session when the device refuses to store them', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(refused);
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(refused);
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation(refused);

    await expect(safeStorage.setItem('scarlets:test-b', 'two')).resolves.toBeUndefined();
    expect(await safeStorage.getItem('scarlets:test-b')).toBe('two');
    expect(await safeStorage.getItem('scarlets:never-set')).toBeNull();

    await expect(safeStorage.removeItem('scarlets:test-b')).resolves.toBeUndefined();
    expect(await safeStorage.getItem('scarlets:test-b')).toBeNull();
  });

  it('gives the demo providers the same protection', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(refused);
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(refused);

    await keyValueStore.set('receipts', '[]');
    expect(await keyValueStore.get('receipts')).toBe('[]');
  });
});
